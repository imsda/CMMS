"use server";

import { type MemberRole, type Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "../../auth";
import { prisma } from "../../lib/prisma";
import {
  evaluateClassRequirements,
  type RequirementInput,
} from "../../lib/class-prerequisite-utils";

type EnrollAttendeeInput = {
  eventId: string;
  rosterMemberId: string;
  eventClassOfferingId: string;
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

async function getDirectorClubIdForEnrollment() {
  const session = await auth();

  if (!session?.user || session.user.role !== "CLUB_DIRECTOR") {
    throw new Error("Only club directors can enroll attendees.");
  }

  const membership = await prisma.clubMembership.findFirst({
    where: {
      userId: session.user.id,
    },
    select: {
      clubId: true,
    },
    orderBy: {
      isPrimary: "desc",
    },
  });

  if (!membership) {
    throw new Error("No club membership found for the current user.");
  }

  return membership.clubId;
}

export async function enrollAttendeeInClass(input: EnrollAttendeeInput) {
  const clubId = await getDirectorClubIdForEnrollment();

  if (!input.eventId || !input.rosterMemberId || !input.eventClassOfferingId) {
    throw new Error("Event, attendee, and class offering are required.");
  }

  await prisma.$transaction(async (tx) => {
    const registrationAttendee = await tx.registrationAttendee.findFirst({
      where: {
        rosterMemberId: input.rosterMemberId,
        eventRegistration: {
          eventId: input.eventId,
          clubId,
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
              clubId,
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

    const enrollmentCount = await tx.classEnrollment.count({
      where: {
        eventClassOfferingId: input.eventClassOfferingId,
      },
    });

    if (typeof offering.capacity === "number" && enrollmentCount >= offering.capacity) {
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
}
