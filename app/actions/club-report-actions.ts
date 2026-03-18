"use server";

import { MemberStatus, MonthlyReportStatus, ReportStatus, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { type Session } from "next-auth";

import { auth } from "../../auth";
import { safeWriteAuditLog } from "../../lib/audit-log";
import { parseMonthInput } from "../../lib/club-activity";
import { getManagedClubContext } from "../../lib/club-management";
import { getClubActivityMonthSnapshot, findRosterYearForClubDate } from "../../lib/data/club-activity";
import {
  buildMonthlyReportScoreLineItems,
  calculateMonthlyReportTotalScore,
  type MonthlyReportScoringInput,
} from "../../lib/monthly-report";
import { readManagedClubId } from "../../lib/director-path";
import { prisma } from "../../lib/prisma";
import { normalizeReviewerText, requireRevisionReason } from "../../lib/review-feedback";

type SortField = "club" | "month";
type SortDirection = "asc" | "desc";

function requireNumber(value: FormDataEntryValue | null, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required.`);
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative whole number.`);
  }

  return parsed;
}

function optionalNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return 0;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error("Numeric values must be non-negative whole numbers.");
  }

  return parsed;
}

function requireMonthStart(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("Report month is required.");
  }

  const parsedDate = new Date(`${value}-01T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error("Report month is invalid.");
  }

  return parsedDate;
}

function requireDate(value: FormDataEntryValue | null, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required.`);
  }

  const parsedDate = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error(`${label} is invalid.`);
  }

  return parsedDate;
}

function requireText(value: FormDataEntryValue | null, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required.`);
  }

  return value.trim();
}

function optionalText(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readBoolean(value: FormDataEntryValue | null) {
  return value === "on" || value === "true" || value === "1";
}

function ensureRole(session: Session | null, role: UserRole, message: string) {
  if (!session?.user || session.user.role !== role) {
    throw new Error(message);
  }
}

function buildMonthlyReportInput(formData: FormData): MonthlyReportScoringInput & {
  meetingDay: string | null;
  meetingTime: string | null;
  meetingLocation: string | null;
  averagePathfinderAttendance: number;
  averageTltAttendance: number;
  averageStaffAttendance: number;
  uniformNotes: string | null;
  submittedByName: string;
} {
  const averageAttendance = requireNumber(formData.get("averageAttendance"), "Average attendance");
  const averagePathfinderAttendance = requireNumber(
    formData.get("averagePathfinderAttendance"),
    "Average Pathfinder attendance",
  );
  const averageTltAttendance = optionalNumber(formData.get("averageTltAttendance"));
  const averageStaffAttendance = requireNumber(
    formData.get("averageStaffAttendance"),
    "Average staff attendance",
  );
  const pathfinderCount = requireNumber(formData.get("pathfinderCount"), "Pathfinder count");
  const tltCount = optionalNumber(formData.get("tltCount"));
  const staffCount = requireNumber(formData.get("staffCount"), "Staff count");
  const meetingOutingCount = requireNumber(formData.get("meetingOutingCount"), "Meetings and outings count");
  const guestHelperCount = optionalNumber(formData.get("guestHelperCount"));
  const uniformCompliance = requireNumber(formData.get("uniformCompliance"), "Uniform compliance");
  const honorParticipantCount = optionalNumber(formData.get("honorParticipantCount"));

  if (uniformCompliance > 100) {
    throw new Error("Uniform compliance must be between 0 and 100.");
  }

  return {
    meetingDay: optionalText(formData.get("meetingDay")),
    meetingTime: optionalText(formData.get("meetingTime")),
    meetingLocation: optionalText(formData.get("meetingLocation")),
    averageAttendance,
    averagePathfinderAttendance,
    averageTltAttendance,
    averageStaffAttendance,
    pathfinderCount,
    tltCount,
    staffCount,
    staffMeetingHeld: readBoolean(formData.get("staffMeetingHeld")),
    meetingOutingCount,
    devotionsEmphasis: optionalText(formData.get("devotionsEmphasis")),
    exercisePromotion: optionalText(formData.get("exercisePromotion")),
    outreachActivities: optionalText(formData.get("outreachActivities")),
    guestHelperCount,
    uniformCompliance,
    uniformNotes: optionalText(formData.get("uniformNotes")),
    honorWorkSummary: optionalText(formData.get("honorWorkSummary")),
    honorParticipantCount,
    bonusNotes: optionalText(formData.get("bonusNotes")),
    submittedByName: requireText(formData.get("submittedByName"), "Submitted by"),
  };
}

async function upsertMonthlyReport(
  clubId: string,
  userId: string,
  reportMonth: Date,
  input: ReturnType<typeof buildMonthlyReportInput>,
  status: MonthlyReportStatus,
) {
  const rosterYear = await findRosterYearForClubDate(clubId, reportMonth);
  const now = new Date();
  const lineItems = buildMonthlyReportScoreLineItems(input);
  const totalScore = calculateMonthlyReportTotalScore(input);

  const report = await prisma.monthlyReport.upsert({
    where: {
      clubId_reportMonth: {
        clubId,
        reportMonth,
      },
    },
    update: {
      clubRosterYearId: rosterYear?.id ?? null,
      meetingDay: input.meetingDay,
      meetingTime: input.meetingTime,
      meetingLocation: input.meetingLocation,
      averageAttendance: input.averageAttendance,
      averagePathfinderAttendance: input.averagePathfinderAttendance,
      averageTltAttendance: input.averageTltAttendance,
      averageStaffAttendance: input.averageStaffAttendance,
      pathfinderCount: input.pathfinderCount,
      tltCount: input.tltCount,
      staffCount: input.staffCount,
      staffMeetingHeld: input.staffMeetingHeld,
      meetingOutingCount: input.meetingOutingCount,
      devotionsEmphasis: input.devotionsEmphasis,
      exercisePromotion: input.exercisePromotion,
      outreachActivities: input.outreachActivities,
      guestHelperCount: input.guestHelperCount,
      uniformCompliance: input.uniformCompliance,
      uniformNotes: input.uniformNotes,
      honorWorkSummary: input.honorWorkSummary,
      honorParticipantCount: input.honorParticipantCount,
      bonusNotes: input.bonusNotes,
      submittedByName: input.submittedByName,
      submittedByUserId: userId,
      signedAt: status === MonthlyReportStatus.DRAFT ? null : now,
      submittedAt: status === MonthlyReportStatus.DRAFT ? null : now,
      status,
      totalScore,
      scoreLineItems: {
        deleteMany: {},
        createMany: {
          data: lineItems.map((item) => ({
            key: item.key,
            label: item.label,
            points: item.points,
            maxPoints: item.maxPoints,
            sortOrder: item.sortOrder,
            notes: item.notes ?? null,
          })),
        },
      },
    },
    create: {
      clubId,
      clubRosterYearId: rosterYear?.id ?? null,
      reportMonth,
      meetingDay: input.meetingDay,
      meetingTime: input.meetingTime,
      meetingLocation: input.meetingLocation,
      averageAttendance: input.averageAttendance,
      averagePathfinderAttendance: input.averagePathfinderAttendance,
      averageTltAttendance: input.averageTltAttendance,
      averageStaffAttendance: input.averageStaffAttendance,
      pathfinderCount: input.pathfinderCount,
      tltCount: input.tltCount,
      staffCount: input.staffCount,
      staffMeetingHeld: input.staffMeetingHeld,
      meetingOutingCount: input.meetingOutingCount,
      devotionsEmphasis: input.devotionsEmphasis,
      exercisePromotion: input.exercisePromotion,
      outreachActivities: input.outreachActivities,
      guestHelperCount: input.guestHelperCount,
      uniformCompliance: input.uniformCompliance,
      uniformNotes: input.uniformNotes,
      honorWorkSummary: input.honorWorkSummary,
      honorParticipantCount: input.honorParticipantCount,
      bonusNotes: input.bonusNotes,
      submittedByName: input.submittedByName,
      submittedByUserId: userId,
      signedAt: status === MonthlyReportStatus.DRAFT ? null : now,
      submittedAt: status === MonthlyReportStatus.DRAFT ? null : now,
      status,
      totalScore,
      scoreLineItems: {
        createMany: {
          data: lineItems.map((item) => ({
            key: item.key,
            label: item.label,
            points: item.points,
            maxPoints: item.maxPoints,
            sortOrder: item.sortOrder,
            notes: item.notes ?? null,
          })),
        },
      },
    },
    include: {
      scoreLineItems: {
        orderBy: {
          sortOrder: "asc",
        },
      },
    },
  });

  return {
    report,
    lineItems,
    totalScore,
  };
}

export async function saveMonthlyReportDraft(formData: FormData) {
  const managedClub = await getManagedClubContext(readManagedClubId(formData.get("clubId")));
  const reportMonth = requireMonthStart(formData.get("reportMonth"));
  const input = buildMonthlyReportInput(formData);

  const result = await upsertMonthlyReport(
    managedClub.clubId,
    managedClub.userId,
    reportMonth,
    input,
    MonthlyReportStatus.DRAFT,
  );

  await safeWriteAuditLog({
    actorUserId: managedClub.userId,
    action: "monthly_report.save_draft",
    targetType: "MonthlyReport",
    targetId: result.report.id,
    clubId: managedClub.clubId,
    summary: `Saved monthly report draft for ${reportMonth.toISOString().slice(0, 7)}.`,
    metadata: {
      totalScore: result.totalScore,
      meetingOutingCount: input.meetingOutingCount,
      uniformCompliance: input.uniformCompliance,
    },
  });

  revalidatePath("/director/reports");
  revalidatePath("/director/dashboard");
  revalidatePath("/admin/reports");
}

export async function submitMonthlyReport(formData: FormData) {
  const managedClub = await getManagedClubContext(readManagedClubId(formData.get("clubId")));
  const reportMonth = requireMonthStart(formData.get("reportMonth"));
  const input = buildMonthlyReportInput(formData);

  const result = await upsertMonthlyReport(
    managedClub.clubId,
    managedClub.userId,
    reportMonth,
    input,
    MonthlyReportStatus.SUBMITTED,
  );

  await safeWriteAuditLog({
    actorUserId: managedClub.userId,
    action: "monthly_report.submit",
    targetType: "MonthlyReport",
    targetId: result.report.id,
    clubId: managedClub.clubId,
    summary: `Submitted monthly report for ${reportMonth.toISOString().slice(0, 7)}.`,
    metadata: {
      totalScore: result.totalScore,
      lineItems: result.lineItems,
    },
  });

  revalidatePath("/director/reports");
  revalidatePath("/director/dashboard");
  revalidatePath("/admin/reports");
}

export async function createMonthlyReport(formData: FormData) {
  await submitMonthlyReport(formData);
}

export async function reviewMonthlyReport(formData: FormData) {
  const session = await auth();
  ensureRole(session, UserRole.SUPER_ADMIN, "Only super admins can review monthly reports.");

  const reportId = requireText(formData.get("reportId"), "Monthly report");
  const nextStatusRaw = requireText(formData.get("status"), "Status");
  const reviewerNotes = normalizeReviewerText(formData.get("reviewerNotes"));
  const revisionRequestedReason =
    nextStatusRaw === MonthlyReportStatus.REVISION_REQUESTED
      ? requireRevisionReason(formData.get("revisionRequestedReason"))
      : normalizeReviewerText(formData.get("revisionRequestedReason"));

  if (
    nextStatusRaw !== MonthlyReportStatus.UNDER_REVIEW &&
    nextStatusRaw !== MonthlyReportStatus.APPROVED &&
    nextStatusRaw !== MonthlyReportStatus.REVISION_REQUESTED
  ) {
    throw new Error("Invalid monthly report review status.");
  }

  const report = await prisma.monthlyReport.findUnique({
    where: {
      id: reportId,
    },
    select: {
      id: true,
      clubId: true,
      status: true,
      reportMonth: true,
    },
  });

  if (!report) {
    throw new Error("Monthly report not found.");
  }

  const nextStatus = nextStatusRaw as MonthlyReportStatus;

  if (report.status === MonthlyReportStatus.DRAFT) {
    throw new Error("Draft reports must be submitted before admin review.");
  }

  await prisma.monthlyReport.update({
    where: {
      id: reportId,
    },
    data: {
      status: nextStatus,
      adminComments: reviewerNotes,
      revisionRequestedReason: nextStatus === MonthlyReportStatus.REVISION_REQUESTED ? revisionRequestedReason : null,
      reviewedAt: new Date(),
      reviewedByUserId: session.user.id,
    },
  });

  await safeWriteAuditLog({
    actorUserId: session.user.id,
    action: "monthly_report.review",
    targetType: "MonthlyReport",
    targetId: reportId,
    clubId: report.clubId,
    summary: `Updated monthly report ${report.reportMonth.toISOString().slice(0, 7)} to ${nextStatus}.`,
    metadata: {
      previousStatus: report.status,
      nextStatus,
      reviewerNotes,
      revisionRequestedReason,
    },
  });

  revalidatePath("/admin/reports");
  revalidatePath(`/admin/reports/monthly/${reportId}`);
  revalidatePath("/director/reports");
  revalidatePath("/director/dashboard");
}

export async function saveClubActivity(formData: FormData) {
  const managedClub = await getManagedClubContext(readManagedClubId(formData.get("clubId")));
  const activityIdValue = formData.get("activityId");
  const activityId = typeof activityIdValue === "string" && activityIdValue.trim().length > 0 ? activityIdValue.trim() : null;
  const activityDate = requireDate(formData.get("activityDate"), "Activity date");
  const title = requireText(formData.get("title"), "Activity title");
  const pathfinderAttendance = requireNumber(formData.get("pathfinderAttendance"), "Pathfinder attendance");
  const staffAttendance = requireNumber(formData.get("staffAttendance"), "Staff attendance");
  const uniformCompliance = requireNumber(formData.get("uniformCompliance"), "Uniform compliance");
  const notesValue = formData.get("notes");
  const notes = typeof notesValue === "string" && notesValue.trim().length > 0 ? notesValue.trim() : null;

  if (uniformCompliance > 100) {
    throw new Error("Uniform compliance must be between 0 and 100.");
  }

  const rosterYear = await findRosterYearForClubDate(managedClub.clubId, activityDate);

  if (!rosterYear) {
    throw new Error("No roster year covers the selected activity date.");
  }

  if (activityId) {
    const existingActivity = await prisma.clubActivity.findFirst({
      where: {
        id: activityId,
        clubRosterYear: {
          clubId: managedClub.clubId,
        },
      },
      select: {
        id: true,
      },
    });

    if (!existingActivity) {
      throw new Error("Activity not found for this club.");
    }

    await prisma.clubActivity.update({
      where: {
        id: activityId,
      },
      data: {
        clubRosterYearId: rosterYear.id,
        activityDate,
        title,
        pathfinderAttendance,
        staffAttendance,
        uniformCompliance,
        notes,
      },
    });
  } else {
    await prisma.clubActivity.create({
      data: {
        clubRosterYearId: rosterYear.id,
        activityDate,
        title,
        pathfinderAttendance,
        staffAttendance,
        uniformCompliance,
        notes,
      },
    });
  }

  revalidatePath("/director/reports");
  revalidatePath("/director/dashboard");
}

export async function deleteClubActivity(formData: FormData) {
  const managedClub = await getManagedClubContext(readManagedClubId(formData.get("clubId")));
  const activityId = requireText(formData.get("activityId"), "Activity");

  const existingActivity = await prisma.clubActivity.findFirst({
    where: {
      id: activityId,
      clubRosterYear: {
        clubId: managedClub.clubId,
      },
    },
    select: {
      id: true,
    },
  });

  if (!existingActivity) {
    throw new Error("Activity not found for this club.");
  }

  await prisma.clubActivity.delete({
    where: {
      id: activityId,
    },
  });

  revalidatePath("/director/reports");
  revalidatePath("/director/dashboard");
}

export async function getDirectorReportsDashboardData(clubIdOverride?: string | null, monthInput?: string | null) {
  const managedClub = await getManagedClubContext(clubIdOverride);
  const clubId = managedClub.clubId;
  const selectedMonth = parseMonthInput(monthInput);

  const [club, recentReports, monthSnapshot] = await Promise.all([
    prisma.club.findUnique({
      where: {
        id: clubId,
      },
      select: {
        name: true,
        code: true,
        rosterYears: {
          where: {
            isActive: true,
          },
          orderBy: {
            startsOn: "desc",
          },
          take: 1,
          select: {
            id: true,
            yearLabel: true,
            members: {
              where: {
                isActive: true,
                memberStatus: { not: MemberStatus.WALK_IN },
              },
              select: {
                memberRole: true,
              },
            },
          },
        },
      },
    }),
    prisma.monthlyReport.findMany({
      where: {
        clubId,
      },
      orderBy: {
        reportMonth: "desc",
      },
      take: 12,
      include: {
        scoreLineItems: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
    }),
    getClubActivityMonthSnapshot(clubId, selectedMonth),
  ]);

  const activeRoster = club?.rosterYears[0] ?? null;
  const rosterMembers = activeRoster?.members ?? [];
  const rosterCounts = rosterMembers.reduce(
    (counts, member) => {
      if (member.memberRole === "PATHFINDER") {
        counts.pathfinderCount += 1;
      } else if (member.memberRole === "TLT") {
        counts.tltCount += 1;
      } else if (member.memberRole === "STAFF" || member.memberRole === "DIRECTOR" || member.memberRole === "COUNSELOR") {
        counts.staffCount += 1;
      }
      return counts;
    },
    {
      pathfinderCount: 0,
      tltCount: 0,
      staffCount: 0,
    },
  );

  const selectedMonthFormValues = {
    ...monthSnapshot.formValues,
    pathfinderCount: monthSnapshot.existingReport ? monthSnapshot.formValues.pathfinderCount : rosterCounts.pathfinderCount,
    tltCount: monthSnapshot.existingReport ? monthSnapshot.formValues.tltCount : rosterCounts.tltCount,
    staffCount: monthSnapshot.existingReport ? monthSnapshot.formValues.staffCount : rosterCounts.staffCount,
    submittedByName: monthSnapshot.formValues.submittedByName || managedClub.userEmail || "",
  };

  const selectedMonthScorePreview = buildMonthlyReportScoreLineItems(selectedMonthFormValues);

  return {
    clubName: club?.name ?? "Your Club",
    clubCode: club?.code ?? "",
    recentReports,
    selectedMonthInput: monthSnapshot.selectedMonthInput,
    selectedMonth,
    selectedRosterYear: monthSnapshot.rosterYear,
    selectedMonthActivities: monthSnapshot.activities,
    selectedMonthAutoFill: monthSnapshot.autoFill,
    selectedMonthExistingReport: monthSnapshot.existingReport,
    selectedMonthFormValues,
    selectedMonthScorePreview,
    selectedMonthTotalScore: selectedMonthScorePreview.reduce((total, item) => total + item.points, 0),
  };
}

export async function getAdminReportsData(sortBy: SortField = "month", direction: SortDirection = "desc") {
  const session = await auth();
  ensureRole(session, UserRole.SUPER_ADMIN, "Only super admins can view conference reports.");
  const currentMonth = parseMonthInput();

  const monthlyOrderBy =
    sortBy === "club"
      ? [{ club: { name: direction } }, { reportMonth: "desc" as const }]
      : [{ reportMonth: direction }, { club: { name: "asc" as const } }];

  const yearEndOrderBy =
    sortBy === "club"
      ? [{ club: { name: direction } }, { reportYear: "desc" as const }]
      : [{ reportYear: direction }, { club: { name: "asc" as const } }];

  const [monthlyReports, yearEndReports] = await Promise.all([
    prisma.monthlyReport.findMany({
      orderBy: monthlyOrderBy,
      include: {
        club: {
          select: {
            name: true,
            code: true,
          },
        },
        scoreLineItems: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
    }),
    prisma.yearEndReport.findMany({
      where: {
        status: ReportStatus.SUBMITTED,
      },
      orderBy: yearEndOrderBy,
      include: {
        club: {
          select: {
            name: true,
            code: true,
          },
        },
      },
    }),
  ]);

  return {
    monthlyReports,
    monthlySummary: {
      submitted: monthlyReports.filter((report) => report.status === MonthlyReportStatus.SUBMITTED).length,
      underReview: monthlyReports.filter((report) => report.status === MonthlyReportStatus.UNDER_REVIEW).length,
      approved: monthlyReports.filter((report) => report.status === MonthlyReportStatus.APPROVED).length,
      revisionRequested: monthlyReports.filter((report) => report.status === MonthlyReportStatus.REVISION_REQUESTED).length,
    },
    yearEndReports,
    missingCurrentMonthReports: (await prisma.club.findMany({
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        code: true,
        type: true,
        monthlyReports: {
          where: {
            reportMonth: currentMonth,
          },
          take: 1,
          select: {
            status: true,
          },
        },
      },
    })).flatMap((club) => {
      const currentReport = club.monthlyReports[0] ?? null;
      if (!currentReport || currentReport.status === MonthlyReportStatus.DRAFT || currentReport.status === MonthlyReportStatus.REVISION_REQUESTED) {
        return [{
          id: club.id,
          name: club.name,
          code: club.code,
          type: club.type,
          status: currentReport?.status ?? null,
        }];
      }

      return [];
    }),
    currentMonth,
  };
}

export async function getAdminMonthlyReportDetail(reportId: string) {
  const session = await auth();
  ensureRole(session, UserRole.SUPER_ADMIN, "Only super admins can view monthly report details.");

  const report = await prisma.monthlyReport.findUnique({
    where: {
      id: reportId,
    },
    include: {
      club: {
        select: {
          name: true,
          code: true,
          type: true,
        },
      },
      clubRosterYear: {
        select: {
          yearLabel: true,
        },
      },
      scoreLineItems: {
        orderBy: {
          sortOrder: "asc",
        },
      },
      submittedByUser: {
        select: {
          name: true,
          email: true,
        },
      },
      reviewedByUser: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  if (!report) {
    throw new Error("Monthly report not found.");
  }

  return report;
}
