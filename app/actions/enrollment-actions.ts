"use server";

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
                minAge: true,
                maxAge: true,
                requiredMemberRole: true,
                requiredHonorCode: true,
                requiredMasterGuide: true,
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
          select: {
            honorCode: true,
          },
        },
      },
    });

    if (!attendee) {
      throw new Error("Attendee not found for your club registration.");
    }

    const eligibility = evaluateClassRequirements(
      {
        ageAtStart: attendee.ageAtStart,
        memberRole: attendee.memberRole,
        masterGuide: attendee.masterGuide,
        completedHonorCodes: attendee.completedRequirements.map((item) => item.honorCode),
      },
      offering.classCatalog.requirements as RequirementInput[],
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

    if (enrollmentCount >= offering.capacity) {
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
