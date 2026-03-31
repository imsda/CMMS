"use server";

import { Prisma, type MemberRole } from "@prisma/client";
import { revalidatePath } from "next/cache";

import {
  findEventEnrollmentConflict,
  formatEnrollmentConflictMessage,
  isOfferingFull,
} from "../../lib/class-model";
import { safeWriteAuditLog } from "../../lib/audit-log";
import { getManagedClubContext } from "../../lib/club-management";
import { prisma } from "../../lib/prisma";
import {
  evaluateClassRequirements,
  type RequirementInput,
} from "../../lib/class-prerequisite-utils";
import { sendClassAssignmentEmail } from "../../lib/email/resend";

type EnrollAttendeeInput = {
  eventId: string;
  rosterMemberId: string;
  eventClassOfferingId: string;
  clubId?: string | null;
};

type BulkEnrollAttendeesInput = {
  eventId: string;
  rosterMemberIds: string[];
  eventClassOfferingId: string;
  clubId?: string | null;
};

type RequirementConfig = {
  minAge?: number;
  maxAge?: number;
  requiredMemberRole?: MemberRole;
  requiredHonorCode?: string;
  requiredMasterGuide?: boolean;
};

function parseRequirementConfig(config: Prisma.JsonValue): RequirementConfig {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return {};
  }

  const raw = config as Record<string, unknown>;

  return {
    minAge: typeof raw.minAge === "number" ? raw.minAge : undefined,
    maxAge: typeof raw.maxAge === "number" ? raw.maxAge : undefined,
    requiredMemberRole: typeof raw.requiredMemberRole === "string" ? (raw.requiredMemberRole as MemberRole) : undefined,
    requiredHonorCode: typeof raw.requiredHonorCode === "string" ? raw.requiredHonorCode : undefined,
    requiredMasterGuide: typeof raw.requiredMasterGuide === "boolean" ? raw.requiredMasterGuide : undefined,
  };
}

function mapRequirementsToEvaluatorInput(
  requirements: Array<{ requirementType: RequirementInput["requirementType"]; config: Prisma.JsonValue }>,
): RequirementInput[] {
  return requirements.map((requirement) => {
    const config = parseRequirementConfig(requirement.config);

    return {
      requirementType: requirement.requirementType,
      minAge: config.minAge ?? null,
      maxAge: config.maxAge ?? null,
      requiredMemberRole: config.requiredMemberRole ?? null,
      requiredHonorCode: config.requiredHonorCode ?? null,
      requiredMasterGuide: config.requiredMasterGuide ?? null,
    };
  });
}

function readHonorCodeFromMetadata(metadata: Prisma.JsonValue): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = (metadata as Record<string, unknown>).honorCode;
  return typeof value === "string" && value.trim().length > 0 ? value.trim().toUpperCase() : null;
}

function summarizeBulkNames(names: string[]) {
  if (names.length <= 3) {
    return names.join(", ");
  }

  return `${names.slice(0, 3).join(", ")} and ${names.length - 3} more`;
}

async function runSerializableEnrollmentTransaction<T>(
  callback: Parameters<typeof prisma.$transaction>[0],
) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(callback, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }) as T;
    } catch (error) {
      lastError = error;

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "P2034" &&
        attempt < 2
      ) {
        continue;
      }

      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unable to complete class enrollment.");
}

async function enrollAttendeeInClassForClub(input: EnrollAttendeeInput & { clubId: string }) {
  if (!input.eventId || !input.rosterMemberId || !input.eventClassOfferingId || !input.clubId) {
    throw new Error("Event, attendee, and class offering are required.");
  }

  await runSerializableEnrollmentTransaction(async (tx) => {
    const registrationAttendee = await tx.registrationAttendee.findFirst({
      where: {
        rosterMemberId: input.rosterMemberId,
          eventRegistration: {
            eventId: input.eventId,
            clubId: input.clubId,
          },
        },
      select: {
        id: true,
      },
    });

    if (!registrationAttendee) {
      throw new Error("Attendee is not registered for this event under your club.");
    }

    const offering = await tx.eventClassOffering.findFirst({
      where: {
        id: input.eventClassOfferingId,
        eventId: input.eventId,
      },
      select: {
        id: true,
        capacity: true,
        eventId: true,
        timeslotId: true,
        classCatalog: {
          select: {
            title: true,
            code: true,
            requirements: {
              select: {
                requirementType: true,
                config: true,
              },
            },
          },
        },
      },
    });

    if (!offering) {
      throw new Error("Class offering was not found for this event.");
    }

    const attendee = await tx.rosterMember.findFirst({
      where: {
        id: input.rosterMemberId,
        registrations: {
          some: {
            eventRegistration: {
              eventId: input.eventId,
              clubId: input.clubId,
            },
          },
        },
      },
      select: {
        ageAtStart: true,
        memberRole: true,
        masterGuide: true,
        completedRequirements: {
          where: {
            requirementType: "COMPLETED_HONOR",
          },
          select: {
            metadata: true,
          },
        },
      },
    });

    if (!attendee) {
      throw new Error("Attendee not found for your club registration.");
    }

    const completedHonorCodes = attendee.completedRequirements
      .map((item) => readHonorCodeFromMetadata(item.metadata))
      .filter((item): item is string => Boolean(item));

    const eligibility = evaluateClassRequirements(
      {
        ageAtStart: attendee.ageAtStart,
        memberRole: attendee.memberRole,
        masterGuide: attendee.masterGuide,
        completedHonorCodes,
      },
      mapRequirementsToEvaluatorInput(offering.classCatalog.requirements),
    );

    if (!eligibility.eligible) {
      throw new Error(`Attendee does not meet class prerequisites: ${eligibility.blockers.join(", ")}.`);
    }

    const existingEnrollment = await tx.classEnrollment.findUnique({
      where: {
        eventClassOfferingId_rosterMemberId: {
          eventClassOfferingId: input.eventClassOfferingId,
          rosterMemberId: input.rosterMemberId,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingEnrollment) {
      return;
    }

    const existingEventEnrollments = await tx.classEnrollment.findMany({
      where: {
        rosterMemberId: input.rosterMemberId,
        offering: {
          eventId: input.eventId,
        },
      },
      select: {
        eventClassOfferingId: true,
        offering: {
          select: {
            timeslotId: true,
            timeslot: {
              select: {
                label: true,
              },
            },
            classCatalog: {
              select: {
                title: true,
                code: true,
              },
            },
          },
        },
      },
    });

    const conflictingEnrollment = findEventEnrollmentConflict(
      existingEventEnrollments.map((enrollment) => ({
        eventClassOfferingId: enrollment.eventClassOfferingId,
        classTitle: enrollment.offering.classCatalog.title,
        classCode: enrollment.offering.classCatalog.code,
        timeslotId: enrollment.offering.timeslotId,
        timeslotLabel: enrollment.offering.timeslot?.label ?? null,
      })),
      input.eventClassOfferingId,
      offering.timeslotId,
    );

    if (conflictingEnrollment) {
      throw new Error(formatEnrollmentConflictMessage(conflictingEnrollment));
    }

    const enrollmentCount = await tx.classEnrollment.count({
      where: {
        eventClassOfferingId: input.eventClassOfferingId,
      },
    });

    if (isOfferingFull(offering.capacity, enrollmentCount)) {
      throw new Error("This class is full. Please choose another class.");
    }

    await tx.classEnrollment.create({
      data: {
        eventClassOfferingId: input.eventClassOfferingId,
        rosterMemberId: input.rosterMemberId,
      },
    });
  });

  revalidatePath(`/director/events/${input.eventId}/classes`);
  revalidatePath(`/admin/events/${input.eventId}/classes`);
}

export async function enrollAttendeeInClass(input: EnrollAttendeeInput) {
  const managedClub = await getManagedClubContext(input.clubId ?? null);
  const clubId = managedClub.clubId;
  await enrollAttendeeInClassForClub({
    ...input,
    clubId,
  });

  await safeWriteAuditLog({
    actorUserId: managedClub.userId,
    action: "enrollment.add",
    targetType: "ClassEnrollment",
    targetId: `${input.eventClassOfferingId}:${input.rosterMemberId}`,
    clubId,
    summary: `Enrolled attendee ${input.rosterMemberId} in offering ${input.eventClassOfferingId}.`,
    metadata: {
      eventId: input.eventId,
    },
  });
}

async function removeAttendeeFromClassForClub(input: EnrollAttendeeInput & { clubId: string }) {
  if (!input.eventId || !input.rosterMemberId || !input.eventClassOfferingId || !input.clubId) {
    throw new Error("Event, attendee, and class offering are required.");
  }

  await runSerializableEnrollmentTransaction(async (tx) => {
    const registrationAttendee = await tx.registrationAttendee.findFirst({
      where: {
        rosterMemberId: input.rosterMemberId,
          eventRegistration: {
            eventId: input.eventId,
            clubId: input.clubId,
          },
        },
      select: {
        id: true,
      },
    });

    if (!registrationAttendee) {
      throw new Error("Attendee is not registered for this event under your club.");
    }

    const offering = await tx.eventClassOffering.findFirst({
      where: {
        id: input.eventClassOfferingId,
        eventId: input.eventId,
      },
      select: {
        id: true,
      },
    });

    if (!offering) {
      throw new Error("Class offering was not found for this event.");
    }

    await tx.classEnrollment.deleteMany({
      where: {
        eventClassOfferingId: input.eventClassOfferingId,
        rosterMemberId: input.rosterMemberId,
      },
    });
  });

  revalidatePath(`/director/events/${input.eventId}/classes`);
}

export async function removeAttendeeFromClass(input: EnrollAttendeeInput) {
  const managedClub = await getManagedClubContext(input.clubId ?? null);
  const clubId = managedClub.clubId;
  await removeAttendeeFromClassForClub({
    ...input,
    clubId,
  });

  await safeWriteAuditLog({
    actorUserId: managedClub.userId,
    action: "enrollment.remove",
    targetType: "ClassEnrollment",
    targetId: `${input.eventClassOfferingId}:${input.rosterMemberId}`,
    clubId,
    summary: `Removed attendee ${input.rosterMemberId} from offering ${input.eventClassOfferingId}.`,
    metadata: {
      eventId: input.eventId,
    },
  });
}

export async function bulkEnrollAttendeesInClass(input: BulkEnrollAttendeesInput) {
  const managedClub = await getManagedClubContext(input.clubId ?? null);
  const clubId = managedClub.clubId;
  const rosterMemberIds = Array.from(new Set(input.rosterMemberIds.filter((id) => id.trim().length > 0)));

  if (rosterMemberIds.length === 0) {
    throw new Error("Select at least one attendee to enroll.");
  }

  await runSerializableEnrollmentTransaction(async (tx) => {
    const offering = await tx.eventClassOffering.findFirst({
      where: {
        id: input.eventClassOfferingId,
        eventId: input.eventId,
      },
      select: {
        id: true,
        capacity: true,
        timeslotId: true,
        classCatalog: {
          select: {
            title: true,
            code: true,
            requirements: {
              select: {
                requirementType: true,
                config: true,
              },
            },
          },
        },
      },
    });

    if (!offering) {
      throw new Error("Class offering was not found for this event.");
    }

    const attendees = await tx.rosterMember.findMany({
      where: {
        id: {
          in: rosterMemberIds,
        },
        registrations: {
          some: {
            eventRegistration: {
              eventId: input.eventId,
              clubId,
            },
          },
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        ageAtStart: true,
        memberRole: true,
        masterGuide: true,
        completedRequirements: {
          where: {
            requirementType: "COMPLETED_HONOR",
          },
          select: {
            metadata: true,
          },
        },
        classEnrollments: {
          where: {
            offering: {
              eventId: input.eventId,
            },
          },
          select: {
            eventClassOfferingId: true,
            offering: {
              select: {
                timeslotId: true,
                timeslot: {
                  select: {
                    label: true,
                  },
                },
                classCatalog: {
                  select: {
                    title: true,
                    code: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (attendees.length !== rosterMemberIds.length) {
      throw new Error("One or more selected attendees are not registered for this event under your club.");
    }

    const toCreate: string[] = [];
    const blockedNames: string[] = [];

    for (const attendee of attendees) {
      const completedHonorCodes = attendee.completedRequirements
        .map((item) => readHonorCodeFromMetadata(item.metadata))
        .filter((item): item is string => Boolean(item));

      const eligibility = evaluateClassRequirements(
        {
          ageAtStart: attendee.ageAtStart,
          memberRole: attendee.memberRole,
          masterGuide: attendee.masterGuide,
          completedHonorCodes,
        },
        mapRequirementsToEvaluatorInput(offering.classCatalog.requirements),
      );

      if (!eligibility.eligible) {
        blockedNames.push(`${attendee.firstName} ${attendee.lastName}`);
        continue;
      }

      const conflict = findEventEnrollmentConflict(
        attendee.classEnrollments.map((enrollment) => ({
          eventClassOfferingId: enrollment.eventClassOfferingId,
          classTitle: enrollment.offering.classCatalog.title,
          classCode: enrollment.offering.classCatalog.code,
          timeslotId: enrollment.offering.timeslotId,
          timeslotLabel: enrollment.offering.timeslot?.label ?? null,
        })),
        input.eventClassOfferingId,
        offering.timeslotId,
      );

      if (conflict) {
        blockedNames.push(`${attendee.firstName} ${attendee.lastName}`);
        continue;
      }

      const alreadyEnrolled = attendee.classEnrollments.some(
        (enrollment) => enrollment.eventClassOfferingId === input.eventClassOfferingId,
      );

      if (!alreadyEnrolled) {
        toCreate.push(attendee.id);
      }
    }

    if (blockedNames.length > 0) {
      throw new Error(
        `Bulk enrollment blocked for ${summarizeBulkNames(blockedNames)}. Remove conflicting assignments or prerequisite blockers first.`,
      );
    }

    const enrollmentCount = await tx.classEnrollment.count({
      where: {
        eventClassOfferingId: input.eventClassOfferingId,
      },
    });

    if (offering.capacity !== null) {
      const seatsLeft = Math.max(offering.capacity - enrollmentCount, 0);
      if (toCreate.length > seatsLeft) {
        throw new Error(`This class only has ${seatsLeft} seat(s) left for ${toCreate.length} attendee(s).`);
      }
    }

    if (toCreate.length > 0) {
      await tx.classEnrollment.createMany({
        data: toCreate.map((rosterMemberId) => ({
          eventClassOfferingId: input.eventClassOfferingId,
          rosterMemberId,
        })),
      });
    }
  });

  revalidatePath(`/director/events/${input.eventId}/classes`);
  revalidatePath(`/admin/events/${input.eventId}/classes`);

  await safeWriteAuditLog({
    actorUserId: managedClub.userId,
    action: "enrollment.bulk_add",
    targetType: "ClassEnrollment",
    targetId: input.eventClassOfferingId,
    clubId,
    summary: `Bulk enrolled ${rosterMemberIds.length} attendee(s) in offering ${input.eventClassOfferingId}.`,
    metadata: {
      eventId: input.eventId,
      rosterMemberCount: rosterMemberIds.length,
    },
  });

  await sendClassAssignmentEmailsForEnrollment({
    eventId: input.eventId,
    eventClassOfferingId: input.eventClassOfferingId,
    enrolledMemberIds: rosterMemberIds,
  });
}

async function sendClassAssignmentEmailsForEnrollment(input: {
  eventId: string;
  eventClassOfferingId: string;
  enrolledMemberIds: string[];
}) {
  const offering = await prisma.eventClassOffering.findUnique({
    where: { id: input.eventClassOfferingId },
    select: {
      classCatalog: { select: { title: true } },
      event: { select: { id: true, name: true } },
    },
  });

  if (!offering) {
    return;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Find all enrolled members for this offering to group by club
  const enrollments = await prisma.classEnrollment.findMany({
    where: {
      eventClassOfferingId: input.eventClassOfferingId,
      rosterMemberId: { in: input.enrolledMemberIds },
    },
    select: {
      rosterMember: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          clubRosterYear: {
            select: {
              club: {
                select: {
                  id: true,
                  name: true,
                  memberships: {
                    where: { user: { role: "CLUB_DIRECTOR" } },
                    orderBy: { isPrimary: "desc" },
                    take: 1,
                    select: { user: { select: { email: true } } },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  // Group members by club
  const byClub = new Map<string, { clubName: string; directorEmail: string | null; members: Array<{ name: string; className: string }> }>();

  for (const enrollment of enrollments) {
    const club = enrollment.rosterMember.clubRosterYear.club;
    const existing = byClub.get(club.id);
    const memberName = `${enrollment.rosterMember.firstName} ${enrollment.rosterMember.lastName}`;
    const entry = { name: memberName, className: offering.classCatalog.title };

    if (existing) {
      existing.members.push(entry);
    } else {
      byClub.set(club.id, {
        clubName: club.name,
        directorEmail: club.memberships[0]?.user?.email ?? null,
        members: [entry],
      });
    }
  }

  for (const { clubName, directorEmail, members } of byClub.values()) {
    if (!directorEmail) {
      continue;
    }

    await sendClassAssignmentEmail({
      to: directorEmail,
      eventName: offering.event.name,
      clubName,
      members,
      classesUrl: `${appUrl}/director/events/${offering.event.id}/classes`,
    });
  }
}

export async function bulkRemoveAttendeesFromClass(input: BulkEnrollAttendeesInput) {
  const managedClub = await getManagedClubContext(input.clubId ?? null);
  const clubId = managedClub.clubId;
  const rosterMemberIds = Array.from(new Set(input.rosterMemberIds.filter((id) => id.trim().length > 0)));

  if (rosterMemberIds.length === 0) {
    throw new Error("Select at least one attendee to remove.");
  }

  await runSerializableEnrollmentTransaction(async (tx) => {
    const attendees = await tx.rosterMember.findMany({
      where: {
        id: {
          in: rosterMemberIds,
        },
        registrations: {
          some: {
            eventRegistration: {
              eventId: input.eventId,
              clubId,
            },
          },
        },
      },
      select: {
        id: true,
      },
    });

    if (attendees.length !== rosterMemberIds.length) {
      throw new Error("One or more selected attendees are not registered for this event under your club.");
    }

    await tx.classEnrollment.deleteMany({
      where: {
        eventClassOfferingId: input.eventClassOfferingId,
        rosterMemberId: {
          in: rosterMemberIds,
        },
      },
    });
  });

  revalidatePath(`/director/events/${input.eventId}/classes`);
  revalidatePath(`/admin/events/${input.eventId}/classes`);

  await safeWriteAuditLog({
    actorUserId: managedClub.userId,
    action: "enrollment.bulk_remove",
    targetType: "ClassEnrollment",
    targetId: input.eventClassOfferingId,
    clubId,
    summary: `Bulk removed ${rosterMemberIds.length} attendee(s) from offering ${input.eventClassOfferingId}.`,
    metadata: {
      eventId: input.eventId,
      rosterMemberCount: rosterMemberIds.length,
    },
  });
}
