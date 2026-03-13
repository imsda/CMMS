import { type Prisma } from "@prisma/client";

import { buildExpiredAuthRateLimitBucketWhere } from "./auth-rate-limit";
import { safeWriteAuditLog } from "./audit-log";
import { prisma } from "./prisma";
import { sendDirectorReadinessReminderEmail } from "./email/resend";
import { purgeInactiveInsuranceCardFiles } from "./storage-cleanup";

export type ScheduledJobKey =
  | "auth-rate-limit-cleanup"
  | "inactive-insurance-card-cleanup"
  | "director-readiness-reminders";

export const SCHEDULED_JOB_KEYS: ScheduledJobKey[] = [
  "auth-rate-limit-cleanup",
  "inactive-insurance-card-cleanup",
  "director-readiness-reminders",
];

export type ScheduledJobResult = {
  jobKey: ScheduledJobKey;
  status: "completed" | "skipped" | "failed";
  summary: string;
  metadata?: Record<string, unknown>;
};

type DirectorReminderInput = {
  clubName: string;
  monthLabel: string;
  missingAdultClearanceCount: number;
  draftRegistrationCount: number;
  unstartedEventCount: number;
  monthlyReportSubmitted: boolean;
};

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function buildScheduledRunDate(date = new Date()) {
  return startOfUtcDay(date);
}

export function startOfUtcMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function buildDirectorReminderItems(input: DirectorReminderInput) {
  const items: string[] = [];

  if (input.missingAdultClearanceCount > 0) {
    items.push(
      `${input.missingAdultClearanceCount} adult leader/staff record(s) are still missing Sterling clearance.`,
    );
  }

  if (input.draftRegistrationCount > 0) {
    items.push(`${input.draftRegistrationCount} event registration draft(s) still need submission.`);
  }

  if (input.unstartedEventCount > 0) {
    items.push(`${input.unstartedEventCount} upcoming event(s) have not been started yet.`);
  }

  if (!input.monthlyReportSubmitted) {
    items.push(`The monthly report for ${input.monthLabel} has not been submitted yet.`);
  }

  return items;
}

export function isScheduledJobAuthorized(authHeader: string | null, expectedSecret: string | null) {
  if (!expectedSecret || expectedSecret.trim().length === 0) {
    return false;
  }

  return authHeader === `Bearer ${expectedSecret}`;
}

export function parseScheduledJobKeys(value: unknown): ScheduledJobKey[] {
  if (value === undefined || value === null || value === "" || value === "all") {
    return [...SCHEDULED_JOB_KEYS];
  }

  const rawValues = Array.isArray(value) ? value : [value];
  const normalized = rawValues
    .flatMap((entry) => typeof entry === "string" ? entry.split(",") : [])
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (normalized.length === 0) {
    return [...SCHEDULED_JOB_KEYS];
  }

  const invalidKeys = normalized.filter((entry): entry is string => !SCHEDULED_JOB_KEYS.includes(entry as ScheduledJobKey));

  if (invalidKeys.length > 0) {
    throw new Error(`Unsupported scheduled job key(s): ${invalidKeys.join(", ")}.`);
  }

  return [...new Set(normalized)] as ScheduledJobKey[];
}

async function claimJobRun(jobKey: ScheduledJobKey, scopeKey: string, runDate: Date) {
  try {
    return await prisma.scheduledJobRun.create({
      data: {
        jobKey,
        scopeKey,
        runDate,
        status: "RUNNING",
        summary: "Job started.",
      },
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      const existingRun = await prisma.scheduledJobRun.findUnique({
        where: {
          jobKey_scopeKey_runDate: {
            jobKey,
            scopeKey,
            runDate,
          },
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (existingRun?.status === "FAILED") {
        return prisma.scheduledJobRun.update({
          where: {
            id: existingRun.id,
          },
          data: {
            status: "RUNNING",
            summary: "Retrying failed job.",
            metadata: null,
            completedAt: null,
          },
        });
      }

      return null;
    }

    throw error;
  }
}

async function finalizeJobRun(
  id: string,
  result: Pick<ScheduledJobResult, "status" | "summary" | "metadata">,
) {
  await prisma.scheduledJobRun.update({
    where: {
      id,
    },
    data: {
      status: result.status.toUpperCase(),
      summary: result.summary,
      metadata: (result.metadata ?? null) as Prisma.InputJsonValue | null,
      completedAt: new Date(),
    },
  });
}

async function runClaimedJob(
  claimedRunId: string,
  jobKey: ScheduledJobKey,
  run: () => Promise<Omit<ScheduledJobResult, "jobKey">>,
) {
  try {
    const result = await run();
    const jobResult: ScheduledJobResult = {
      jobKey,
      ...result,
    };

    await finalizeJobRun(claimedRunId, jobResult);
    return jobResult;
  } catch (error) {
    const summary = error instanceof Error ? error.message : "Scheduled job failed.";

    const jobResult: ScheduledJobResult = {
      jobKey,
      status: "failed",
      summary,
      metadata: {
        error: summary,
      },
    };

    await finalizeJobRun(claimedRunId, jobResult);
    throw error;
  }
}

export async function runAuthRateLimitCleanupJob(runDate = new Date()): Promise<ScheduledJobResult> {
  const claimedRun = await claimJobRun("auth-rate-limit-cleanup", "system", buildScheduledRunDate(runDate));

  if (!claimedRun) {
    return {
      jobKey: "auth-rate-limit-cleanup",
      status: "skipped",
      summary: "Auth rate-limit cleanup already ran for this UTC day.",
    };
  }

  const jobResult = await runClaimedJob(claimedRun.id, "auth-rate-limit-cleanup", async () => {
    const result = await prisma.authRateLimitBucket.deleteMany({
      where: buildExpiredAuthRateLimitBucketWhere(runDate),
    });

    return {
      status: "completed",
      summary: `Deleted ${result.count} expired auth rate-limit bucket(s).`,
      metadata: {
        deletedCount: result.count,
      },
    };
  });

  await safeWriteAuditLog({
    action: "scheduled_job.auth_rate_limit_cleanup",
    targetType: "ScheduledJobRun",
    targetId: claimedRun.id,
    summary: jobResult.summary,
    metadata: jobResult.metadata,
  });

  return jobResult;
}

export async function runInactiveInsuranceCardCleanupJob(runDate = new Date()): Promise<ScheduledJobResult> {
  const claimedRun = await claimJobRun("inactive-insurance-card-cleanup", "system", buildScheduledRunDate(runDate));

  if (!claimedRun) {
    return {
      jobKey: "inactive-insurance-card-cleanup",
      status: "skipped",
      summary: "Inactive insurance card cleanup already ran for this UTC day.",
    };
  }

  const jobResult = await runClaimedJob(claimedRun.id, "inactive-insurance-card-cleanup", async () => {
    const result = await purgeInactiveInsuranceCardFiles();

    return {
      status: "completed",
      summary: `Purged ${result.filesDeleted} inactive insurance card file(s).`,
      metadata: {
        filesDeleted: result.filesDeleted,
        megabytesFreed: result.megabytesFreed,
        clearedMemberCount: result.clearedMemberCount,
      },
    };
  });

  await safeWriteAuditLog({
    action: "scheduled_job.inactive_insurance_card_cleanup",
    targetType: "ScheduledJobRun",
    targetId: claimedRun.id,
    summary: jobResult.summary,
    metadata: jobResult.metadata,
  });

  return jobResult;
}

export async function runDirectorReadinessReminderJob(runDate = new Date()): Promise<ScheduledJobResult> {
  const runDay = buildScheduledRunDate(runDate);
  const runMonth = startOfUtcMonth(runDate);
  const monthLabel = runDay.toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
  const upcomingEvents = await prisma.event.findMany({
    where: {
      endsAt: {
        gte: runDate,
      },
      registrationOpensAt: {
        lte: runDate,
      },
    },
    select: {
      id: true,
    },
  });

  const upcomingEventIds = upcomingEvents.map((event) => event.id);
  const clubs = await prisma.club.findMany({
    select: {
      id: true,
      name: true,
      memberships: {
        where: {
          isPrimary: true,
          user: {
            role: "CLUB_DIRECTOR",
          },
        },
        select: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
        take: 1,
      },
      rosterYears: {
        where: {
          isActive: true,
        },
        select: {
          id: true,
          members: {
            where: {
              isActive: true,
            },
            select: {
              memberRole: true,
              backgroundCheckCleared: true,
            },
          },
        },
        take: 1,
      },
      registrations: {
        where: {
          eventId: {
            in: upcomingEventIds.length > 0 ? upcomingEventIds : ["__none__"],
          },
        },
        select: {
          eventId: true,
          status: true,
        },
      },
      monthlyReports: {
        where: {
          reportMonth: runMonth,
        },
        select: {
          status: true,
        },
        take: 1,
      },
    },
  });

  let remindersSent = 0;

  for (const club of clubs) {
    const directorEmail = club.memberships[0]?.user.email ?? null;
    if (!directorEmail) {
      continue;
    }

    const activeRoster = club.rosterYears[0];
    const adultMembers = activeRoster?.members.filter((member) =>
      ["STAFF", "DIRECTOR", "COUNSELOR"].includes(member.memberRole),
    ) ?? [];
    const missingAdultClearanceCount = adultMembers.filter((member) => !member.backgroundCheckCleared).length;
    const draftRegistrationCount = club.registrations.filter((registration) => registration.status === "DRAFT").length;
    const startedEventIds = new Set(club.registrations.map((registration) => registration.eventId));
    const unstartedEventCount = upcomingEventIds.filter((eventId) => !startedEventIds.has(eventId)).length;
    const monthlyReportSubmitted = club.monthlyReports[0]?.status === "SUBMITTED";

    const items = buildDirectorReminderItems({
      clubName: club.name,
      monthLabel,
      missingAdultClearanceCount,
      draftRegistrationCount,
      unstartedEventCount,
      monthlyReportSubmitted,
    });

    if (items.length === 0) {
      continue;
    }

    const scopeKey = club.id;
    const claimedRun = await claimJobRun("director-readiness-reminders", scopeKey, runDay);

    if (!claimedRun) {
      continue;
    }

    const emailResult = await sendDirectorReadinessReminderEmail({
      to: directorEmail,
      clubName: club.name,
      items,
      monthLabel,
    });

    const summary = emailResult.sent
      ? `Sent readiness reminder to ${club.name}.`
      : `Skipped readiness reminder for ${club.name}: ${emailResult.error}.`;

    await finalizeJobRun(claimedRun.id, {
      status: "completed",
      summary,
      metadata: {
        sent: emailResult.sent,
        itemCount: items.length,
        unstartedEventCount,
      },
    });

    await safeWriteAuditLog({
      action: "scheduled_job.director_readiness_reminder",
      targetType: "ScheduledJobRun",
      targetId: claimedRun.id,
      clubId: club.id,
      clubRosterYearId: activeRoster?.id ?? null,
      summary,
      metadata: {
        sent: emailResult.sent,
        itemCount: items.length,
        unstartedEventCount,
      },
    });

    if (emailResult.sent) {
      remindersSent += 1;
    }
  }

  return {
    jobKey: "director-readiness-reminders",
    status: "completed",
    summary: `Processed director readiness reminders for ${clubs.length} club(s); ${remindersSent} email(s) sent.`,
    metadata: {
      clubCount: clubs.length,
      remindersSent,
    },
  };
}

export async function runScheduledJobs(jobKeys?: ScheduledJobKey[], runDate = new Date()) {
  const requestedJobs = jobKeys && jobKeys.length > 0 ? jobKeys : [...SCHEDULED_JOB_KEYS];

  const results: ScheduledJobResult[] = [];

  for (const jobKey of requestedJobs) {
    if (jobKey === "auth-rate-limit-cleanup") {
      results.push(await runAuthRateLimitCleanupJob(runDate));
      continue;
    }

    if (jobKey === "inactive-insurance-card-cleanup") {
      results.push(await runInactiveInsuranceCardCleanupJob(runDate));
      continue;
    }

    results.push(await runDirectorReadinessReminderJob(runDate));
  }

  return results;
}
