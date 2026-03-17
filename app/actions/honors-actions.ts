"use server";

import { Prisma, UserRole, type MemberRole, type RequirementType } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "../../auth";
import { enrollAttendeeInClass, removeAttendeeFromClass } from "./enrollment-actions";
import {
  evaluateClassRequirements,
  type RequirementInput,
} from "../../lib/class-prerequisite-utils";
import { getManagedClubContext } from "../../lib/club-management";
import { prisma } from "../../lib/prisma";

function requireTrimmedString(value: FormDataEntryValue | null, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required.`);
  }

  return value.trim();
}

function optionalTrimmedString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function toUniqueIds(values: FormDataEntryValue[]) {
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  );
}

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
  requirements: Array<{ requirementType: RequirementType; config: Prisma.JsonValue }>,
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

export async function saveRankedClassPreferences(formData: FormData) {
  const eventId = requireTrimmedString(formData.get("eventId"), "Event");
  const timeslotId = requireTrimmedString(formData.get("timeslotId"), "Timeslot");
  const registrationAttendeeId = requireTrimmedString(formData.get("registrationAttendeeId"), "Attendee");
  const clubIdOverride = optionalTrimmedString(formData.get("clubId"));
  const offeringIds = toUniqueIds(formData.getAll("preferenceOfferingIds"));

  const managedClub = await getManagedClubContext(clubIdOverride);

  const registrationAttendee = await prisma.registrationAttendee.findFirst({
    where: {
      id: registrationAttendeeId,
      eventRegistration: {
        eventId,
        clubId: managedClub.clubId,
      },
    },
    select: {
      id: true,
    },
  });

  if (!registrationAttendee) {
    throw new Error("Attendee was not found for this event registration.");
  }

  const timeslot = await prisma.eventClassTimeslot.findFirst({
    where: {
      id: timeslotId,
      eventId,
      active: true,
    },
    select: {
      id: true,
    },
  });

  if (!timeslot) {
    throw new Error("Selected timeslot was not found for this event.");
  }

  if (offeringIds.length > 0) {
    const offerings = await prisma.eventClassOffering.findMany({
      where: {
        id: {
          in: offeringIds,
        },
        eventId,
        timeslotId,
        active: true,
      },
      select: {
        id: true,
      },
    });

    if (offerings.length !== offeringIds.length) {
      throw new Error("One or more selected class preferences are invalid for this timeslot.");
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.eventClassPreference.deleteMany({
      where: {
        timeslotId,
        registrationAttendeeId,
      },
    });

    if (offeringIds.length > 0) {
      await tx.eventClassPreference.createMany({
        data: offeringIds.map((eventClassOfferingId, index) => ({
          eventId,
          timeslotId,
          registrationAttendeeId,
          eventClassOfferingId,
          rank: index + 1,
        })),
      });
    }
  });

  revalidatePath(`/director/events/${eventId}/classes`);
  revalidatePath(`/admin/events/${eventId}/classes`);
}

export type BatchPreferenceItem = {
  registrationAttendeeId: string;
  timeslotId: string;
  offeringIds: string[];
};

export async function saveAllClassPreferences(input: {
  eventId: string;
  registrationId: string;
  clubId?: string | null;
  preferences: BatchPreferenceItem[];
}) {
  const managedClub = await getManagedClubContext(input.clubId ?? null);

  const registration = await prisma.eventRegistration.findFirst({
    where: {
      id: input.registrationId,
      eventId: input.eventId,
      clubId: managedClub.clubId,
    },
    select: { id: true },
  });

  if (!registration) {
    throw new Error("Registration not found for this event.");
  }

  const attendeeIds = Array.from(new Set(input.preferences.map((p) => p.registrationAttendeeId)));

  if (attendeeIds.length > 0) {
    const attendees = await prisma.registrationAttendee.findMany({
      where: {
        id: { in: attendeeIds },
        eventRegistrationId: registration.id,
      },
      select: { id: true },
    });

    if (attendees.length !== attendeeIds.length) {
      throw new Error("One or more attendees do not belong to this registration.");
    }
  }

  const timeslotIds = Array.from(new Set(input.preferences.map((p) => p.timeslotId)));

  if (timeslotIds.length > 0) {
    const timeslots = await prisma.eventClassTimeslot.findMany({
      where: { id: { in: timeslotIds }, eventId: input.eventId, active: true },
      select: { id: true },
    });

    if (timeslots.length !== timeslotIds.length) {
      throw new Error("One or more timeslots are invalid for this event.");
    }
  }

  const allOfferingIds = Array.from(new Set(input.preferences.flatMap((p) => p.offeringIds)));

  if (allOfferingIds.length > 0) {
    const offerings = await prisma.eventClassOffering.findMany({
      where: { id: { in: allOfferingIds }, eventId: input.eventId, active: true },
      select: { id: true, timeslotId: true },
    });

    const offeringMap = new Map(offerings.map((o) => [o.id, o]));

    for (const pref of input.preferences) {
      for (const offeringId of pref.offeringIds) {
        const offering = offeringMap.get(offeringId);
        if (!offering) {
          throw new Error(`Offering ${offeringId} is not active or valid for this event.`);
        }
        if (offering.timeslotId !== pref.timeslotId) {
          throw new Error(`Offering ${offeringId} does not belong to timeslot ${pref.timeslotId}.`);
        }
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const pref of input.preferences) {
      await tx.eventClassPreference.deleteMany({
        where: {
          timeslotId: pref.timeslotId,
          registrationAttendeeId: pref.registrationAttendeeId,
        },
      });

      const uniqueOfferingIds = Array.from(new Set(pref.offeringIds));

      if (uniqueOfferingIds.length > 0) {
        await tx.eventClassPreference.createMany({
          data: uniqueOfferingIds.map((eventClassOfferingId, index) => ({
            eventId: input.eventId,
            timeslotId: pref.timeslotId,
            registrationAttendeeId: pref.registrationAttendeeId,
            eventClassOfferingId,
            rank: index + 1,
          })),
        });
      }
    }
  });

  revalidatePath(`/director/events/${input.eventId}/classes`);
  revalidatePath(`/admin/events/${input.eventId}/classes`);
}

async function ensureSuperAdmin() {
  const session = await auth();

  if (!session?.user || session.user.role !== UserRole.SUPER_ADMIN) {
    throw new Error("Only super admins can manage honors placement.");
  }
}

async function assignRosterMemberToOffering(input: {
  eventId: string;
  timeslotId: string;
  rosterMemberId: string;
  clubId: string;
  nextOfferingId: string | null;
  autoPromoteSourceWaitlist?: boolean;
}) {
  const existingEnrollment = await prisma.classEnrollment.findFirst({
    where: {
      rosterMemberId: input.rosterMemberId,
      offering: {
        eventId: input.eventId,
        OR: [{ timeslotId: input.timeslotId }, { timeslotId: null }],
      },
    },
    select: {
      eventClassOfferingId: true,
    },
  });

  const sourceOfferingId =
    existingEnrollment && existingEnrollment.eventClassOfferingId !== input.nextOfferingId
      ? existingEnrollment.eventClassOfferingId
      : null;

  if (input.nextOfferingId && existingEnrollment?.eventClassOfferingId !== input.nextOfferingId) {
    if (existingEnrollment) {
      await removeAttendeeFromClass({
        eventId: input.eventId,
        rosterMemberId: input.rosterMemberId,
        eventClassOfferingId: existingEnrollment.eventClassOfferingId,
        clubId: input.clubId,
      });
    }

    await enrollAttendeeInClass({
      eventId: input.eventId,
      rosterMemberId: input.rosterMemberId,
      eventClassOfferingId: input.nextOfferingId,
      clubId: input.clubId,
    });
  } else if (!input.nextOfferingId && existingEnrollment) {
    await removeAttendeeFromClass({
      eventId: input.eventId,
      rosterMemberId: input.rosterMemberId,
      eventClassOfferingId: existingEnrollment.eventClassOfferingId,
      clubId: input.clubId,
    });
  }

  await prisma.eventClassWaitlist.deleteMany({
    where: {
      eventId: input.eventId,
      timeslotId: input.timeslotId,
      registrationAttendee: {
        rosterMemberId: input.rosterMemberId,
      },
    },
  });

  if (input.autoPromoteSourceWaitlist && sourceOfferingId) {
    await promoteWaitlistEntriesForOffering({
      eventId: input.eventId,
      eventClassOfferingId: sourceOfferingId,
      promotionLimit: 1,
    });
  }
}

export async function addAttendeeToClassWaitlist(formData: FormData) {
  await ensureSuperAdmin();

  const eventId = requireTrimmedString(formData.get("eventId"), "Event");
  const timeslotId = requireTrimmedString(formData.get("timeslotId"), "Timeslot");
  const registrationAttendeeId = requireTrimmedString(formData.get("registrationAttendeeId"), "Attendee");
  const eventClassOfferingId = requireTrimmedString(formData.get("eventClassOfferingId"), "Class");

  const [registrationAttendee, offering, existingWaitlist, currentMaxPosition] = await Promise.all([
    prisma.registrationAttendee.findFirst({
      where: {
        id: registrationAttendeeId,
        eventRegistration: {
          eventId,
        },
      },
      select: {
        id: true,
        rosterMemberId: true,
      },
    }),
    prisma.eventClassOffering.findFirst({
      where: {
        id: eventClassOfferingId,
        eventId,
        timeslotId,
        active: true,
      },
      select: {
        id: true,
        capacity: true,
      },
    }),
    prisma.eventClassWaitlist.findFirst({
      where: {
        timeslotId,
        registrationAttendeeId,
      },
      select: {
        id: true,
      },
    }),
    prisma.eventClassWaitlist.aggregate({
      where: {
        eventClassOfferingId,
      },
      _max: {
        position: true,
      },
    }),
  ]);

  if (!registrationAttendee || !offering) {
    throw new Error("Attendee or class offering could not be found for this waitlist entry.");
  }

  const existingEnrollment = await prisma.classEnrollment.findFirst({
    where: {
      rosterMemberId: registrationAttendee.rosterMemberId,
      offering: {
        eventId,
        OR: [{ timeslotId }, { timeslotId: null }],
      },
    },
    select: {
      id: true,
    },
  });

  if (existingEnrollment) {
    throw new Error("Attendee is already placed in this timeslot. Remove the assignment before adding to the waitlist.");
  }

  await prisma.$transaction(async (tx) => {
    if (existingWaitlist) {
      await tx.eventClassWaitlist.delete({
        where: {
          id: existingWaitlist.id,
        },
      });
    }

    await tx.eventClassWaitlist.create({
      data: {
        eventId,
        timeslotId,
        registrationAttendeeId,
        eventClassOfferingId,
        position: (currentMaxPosition._max.position ?? 0) + 1,
      },
    });
  });

  revalidatePath(`/admin/events/${eventId}/classes`);
}

export async function removeAttendeeFromClassWaitlist(formData: FormData) {
  await ensureSuperAdmin();

  const eventId = requireTrimmedString(formData.get("eventId"), "Event");
  const waitlistEntryId = requireTrimmedString(formData.get("waitlistEntryId"), "Waitlist entry");

  const waitlistEntry = await prisma.eventClassWaitlist.findFirst({
    where: {
      id: waitlistEntryId,
      eventId,
    },
    select: {
      id: true,
    },
  });

  if (!waitlistEntry) {
    throw new Error("Waitlist entry not found.");
  }

  await prisma.eventClassWaitlist.delete({
    where: {
      id: waitlistEntry.id,
    },
  });

  revalidatePath(`/admin/events/${eventId}/classes`);
}

async function getSuggestedOfferingForAttendee(input: {
  eventId: string;
  timeslotId: string;
  registrationAttendeeId: string;
  clubId?: string | null;
}) {
  const registrationAttendee = await prisma.registrationAttendee.findFirst({
    where: {
      id: input.registrationAttendeeId,
      eventRegistration: {
        eventId: input.eventId,
        ...(input.clubId ? { clubId: input.clubId } : {}),
      },
    },
    select: {
      id: true,
      rosterMemberId: true,
      eventRegistration: {
        select: {
          clubId: true,
        },
      },
      classPreferences: {
        where: {
          eventId: input.eventId,
          timeslotId: input.timeslotId,
        },
        orderBy: {
          rank: "asc",
        },
        select: {
          rank: true,
          eventClassOfferingId: true,
          offering: {
            select: {
              id: true,
              capacity: true,
              active: true,
              classCatalog: {
                select: {
                  requirements: {
                    select: {
                      requirementType: true,
                      config: true,
                    },
                  },
                },
              },
              _count: {
                select: {
                  enrollments: true,
                },
              },
            },
          },
        },
      },
      rosterMember: {
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
      },
    },
  });

  if (!registrationAttendee) {
    return null;
  }

  const suggestedPreference = registrationAttendee.classPreferences.find((preference) => {
    if (!preference.offering.active) {
      return false;
    }

    const requirements = mapRequirementsToEvaluatorInput(preference.offering.classCatalog.requirements);
    const eligibility = evaluateClassRequirements(
      {
        ageAtStart: registrationAttendee.rosterMember.ageAtStart,
        memberRole: registrationAttendee.rosterMember.memberRole,
        masterGuide: registrationAttendee.rosterMember.masterGuide,
        completedHonorCodes: registrationAttendee.rosterMember.completedRequirements
          .map((item) => readHonorCodeFromMetadata(item.metadata))
          .filter((item): item is string => Boolean(item)),
      },
      requirements,
    );

    if (!eligibility.eligible) {
      return false;
    }

    if (preference.offering.capacity === null) {
      return true;
    }

    return preference.offering._count.enrollments < preference.offering.capacity;
  });

  if (!suggestedPreference) {
    return null;
  }

  return {
    rosterMemberId: registrationAttendee.rosterMemberId,
    clubId: registrationAttendee.eventRegistration.clubId,
    eventClassOfferingId: suggestedPreference.eventClassOfferingId,
  };
}

async function getBulkAttendeeTargets(input: {
  eventId: string;
  registrationAttendeeIds: string[];
}) {
  const ids = Array.from(new Set(input.registrationAttendeeIds.filter((id) => id.length > 0)));
  if (ids.length === 0) {
    return [];
  }

  return prisma.registrationAttendee.findMany({
    where: {
      id: {
        in: ids,
      },
      eventRegistration: {
        eventId: input.eventId,
      },
    },
    select: {
      id: true,
      rosterMemberId: true,
      eventRegistration: {
        select: {
          clubId: true,
        },
      },
    },
  });
}

async function promoteWaitlistEntriesForOffering(input: {
  eventId: string;
  eventClassOfferingId: string;
  promotionLimit?: number | null;
  fillOpenSeats?: boolean;
}) {
  const offering = await prisma.eventClassOffering.findFirst({
    where: {
      id: input.eventClassOfferingId,
      eventId: input.eventId,
    },
    select: {
      id: true,
      timeslotId: true,
      capacity: true,
      active: true,
      _count: {
        select: {
          enrollments: true,
        },
      },
      classCatalog: {
        select: {
          requirements: {
            select: {
              requirementType: true,
              config: true,
            },
          },
        },
      },
      waitlistEntries: {
        orderBy: {
          position: "asc",
        },
        select: {
          id: true,
          registrationAttendee: {
            select: {
              rosterMemberId: true,
              eventRegistration: {
                select: {
                  clubId: true,
                },
              },
              rosterMember: {
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
                  classEnrollments: {
                    where: {
                      offering: {
                        eventId: input.eventId,
                      },
                    },
                    select: {
                      id: true,
                      offering: {
                        select: {
                          timeslotId: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!offering || !offering.timeslotId || !offering.active) {
    return;
  }

  const requirements = mapRequirementsToEvaluatorInput(offering.classCatalog.requirements);
  const openSeats =
    offering.capacity === null ? null : Math.max(offering.capacity - offering._count.enrollments, 0);
  const targetPromotions = input.fillOpenSeats ? openSeats ?? offering.waitlistEntries.length : input.promotionLimit ?? 1;

  if (targetPromotions <= 0) {
    return;
  }

  let promotedCount = 0;

  for (const waitlistEntry of offering.waitlistEntries) {
    if (promotedCount >= targetPromotions) {
      break;
    }

    const attendee = waitlistEntry.registrationAttendee.rosterMember;
    const conflictingEnrollment = attendee.classEnrollments.some(
      (enrollment) =>
        enrollment.offering.timeslotId === offering.timeslotId || enrollment.offering.timeslotId === null,
    );

    if (conflictingEnrollment) {
      await prisma.eventClassWaitlist.delete({
        where: {
          id: waitlistEntry.id,
        },
      });
      continue;
    }

    const eligibility = evaluateClassRequirements(
      {
        ageAtStart: attendee.ageAtStart,
        memberRole: attendee.memberRole,
        masterGuide: attendee.masterGuide,
        completedHonorCodes: attendee.completedRequirements
          .map((item) => readHonorCodeFromMetadata(item.metadata))
          .filter((item): item is string => Boolean(item)),
      },
      requirements,
    );

    if (!eligibility.eligible) {
      continue;
    }

    await assignRosterMemberToOffering({
      eventId: input.eventId,
      timeslotId: offering.timeslotId,
      rosterMemberId: waitlistEntry.registrationAttendee.rosterMemberId,
      clubId: waitlistEntry.registrationAttendee.eventRegistration.clubId,
      nextOfferingId: offering.id,
      autoPromoteSourceWaitlist: false,
    });
    promotedCount += 1;
  }
}

export async function assignAttendeeToTimeslotOffering(formData: FormData) {
  await ensureSuperAdmin();

  const eventId = requireTrimmedString(formData.get("eventId"), "Event");
  const timeslotId = requireTrimmedString(formData.get("timeslotId"), "Timeslot");
  const rosterMemberId = requireTrimmedString(formData.get("rosterMemberId"), "Attendee");
  const clubId = requireTrimmedString(formData.get("clubId"), "Club");
  const nextOfferingId = optionalTrimmedString(formData.get("eventClassOfferingId"));
  const autoPromoteSourceWaitlist = formData.get("autoPromoteSourceWaitlist") === "on";

  await assignRosterMemberToOffering({
    eventId,
    timeslotId,
    rosterMemberId,
    clubId,
    nextOfferingId,
    autoPromoteSourceWaitlist,
  });

  revalidatePath(`/admin/events/${eventId}/classes`);
}

export async function assignSuggestedTimeslotOffering(formData: FormData) {
  await ensureSuperAdmin();

  const eventId = requireTrimmedString(formData.get("eventId"), "Event");
  const timeslotId = requireTrimmedString(formData.get("timeslotId"), "Timeslot");
  const registrationAttendeeId = requireTrimmedString(formData.get("registrationAttendeeId"), "Attendee");
  const clubId = requireTrimmedString(formData.get("clubId"), "Club");

  const suggestion = await getSuggestedOfferingForAttendee({
    eventId,
    timeslotId,
    registrationAttendeeId,
    clubId,
  });

  if (!suggestion) {
    throw new Error("No eligible preferred class with open seats is available for this attendee.");
  }

  await assignRosterMemberToOffering({
    eventId,
    timeslotId,
    rosterMemberId: suggestion.rosterMemberId,
    clubId: suggestion.clubId,
    nextOfferingId: suggestion.eventClassOfferingId,
  });

  revalidatePath(`/admin/events/${eventId}/classes`);
}

export async function bulkAssignSuggestedTimeslotOfferings(formData: FormData) {
  await ensureSuperAdmin();

  const eventId = requireTrimmedString(formData.get("eventId"), "Event");
  const timeslotId = requireTrimmedString(formData.get("timeslotId"), "Timeslot");
  const registrationAttendeeIds = toUniqueIds(formData.getAll("registrationAttendeeIds"));
  const targets = await getBulkAttendeeTargets({ eventId, registrationAttendeeIds });

  for (const target of targets) {
    const suggestion = await getSuggestedOfferingForAttendee({
      eventId,
      timeslotId,
      registrationAttendeeId: target.id,
      clubId: target.eventRegistration.clubId,
    });

    if (!suggestion) {
      continue;
    }

    await assignRosterMemberToOffering({
      eventId,
      timeslotId,
      rosterMemberId: suggestion.rosterMemberId,
      clubId: suggestion.clubId,
      nextOfferingId: suggestion.eventClassOfferingId,
    });
  }

  revalidatePath(`/admin/events/${eventId}/classes`);
}

export async function bulkClearTimeslotPlacements(formData: FormData) {
  await ensureSuperAdmin();

  const eventId = requireTrimmedString(formData.get("eventId"), "Event");
  const timeslotId = requireTrimmedString(formData.get("timeslotId"), "Timeslot");
  const registrationAttendeeIds = toUniqueIds(formData.getAll("registrationAttendeeIds"));
  const autoPromoteSourceWaitlist = formData.get("autoPromoteSourceWaitlist") === "on";
  const targets = await getBulkAttendeeTargets({ eventId, registrationAttendeeIds });

  for (const target of targets) {
    await assignRosterMemberToOffering({
      eventId,
      timeslotId,
      rosterMemberId: target.rosterMemberId,
      clubId: target.eventRegistration.clubId,
      nextOfferingId: null,
      autoPromoteSourceWaitlist,
    });
  }

  revalidatePath(`/admin/events/${eventId}/classes`);
}

export async function bulkReassignTimeslotOfferings(formData: FormData) {
  await ensureSuperAdmin();

  const eventId = requireTrimmedString(formData.get("eventId"), "Event");
  const timeslotId = requireTrimmedString(formData.get("timeslotId"), "Timeslot");
  const nextOfferingId = requireTrimmedString(formData.get("eventClassOfferingId"), "Target class");
  const registrationAttendeeIds = toUniqueIds(formData.getAll("registrationAttendeeIds"));
  const autoPromoteSourceWaitlist = formData.get("autoPromoteSourceWaitlist") === "on";
  const targets = await getBulkAttendeeTargets({ eventId, registrationAttendeeIds });

  for (const target of targets) {
    await assignRosterMemberToOffering({
      eventId,
      timeslotId,
      rosterMemberId: target.rosterMemberId,
      clubId: target.eventRegistration.clubId,
      nextOfferingId,
      autoPromoteSourceWaitlist,
    });
  }

  revalidatePath(`/admin/events/${eventId}/classes`);
}

export async function promoteClassWaitlistEntries(formData: FormData) {
  await ensureSuperAdmin();

  const eventId = requireTrimmedString(formData.get("eventId"), "Event");
  const eventClassOfferingId = requireTrimmedString(formData.get("eventClassOfferingId"), "Class");
  const rawCount = optionalTrimmedString(formData.get("promotionCount"));
  const fillOpenSeats = formData.get("fillOpenSeats") === "on";
  const promotionLimit =
    rawCount === null ? null : Math.max(0, Number.parseInt(rawCount, 10) || 0);

  await promoteWaitlistEntriesForOffering({
    eventId,
    eventClassOfferingId,
    promotionLimit,
    fillOpenSeats,
  });

  revalidatePath(`/admin/events/${eventId}/classes`);
}
