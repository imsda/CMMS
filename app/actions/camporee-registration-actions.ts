"use server";

import { PaymentStatus, RegistrationStatus, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "../../auth";
import {
  EMPTY_CAMPOREE_REGISTRATION,
  parseCamporeeRegistrationPayload,
  validateCamporeeRegistrationPayload,
  type CamporeeRegistrationPayload,
} from "../../lib/camporee-registration";
import { isCamporeeWorkflowEvent } from "../../lib/camporee-workflow";
import { getManagedClubContext } from "../../lib/club-management";
import { sendRegistrationReceiptEmail } from "../../lib/email/resend";
import { prisma } from "../../lib/prisma";
import { generateRegistrationCode } from "../../lib/registration-code";
import { assertRegistrationCanPersist } from "../../lib/registration-lifecycle";
import { normalizeReviewerText, requireRevisionReason } from "../../lib/review-feedback";

export type CamporeeRegistrationActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

const INITIAL_RESULT = {
  emailWarning: null as string | null,
};

function requireTrimmedString(value: FormDataEntryValue | null, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required.`);
  }

  return value.trim();
}

async function requireSuperAdmin() {
  const session = await auth();

  if (!session?.user || session.user.role !== UserRole.SUPER_ADMIN) {
    throw new Error("Only super admins can manage Camporee registrations.");
  }
}

async function getCamporeeRegistrationContext(input: {
  eventId: string;
  clubId: string;
  directorEmail: string | null;
}) {
  const club = await prisma.club.findUnique({
    where: {
      id: input.clubId,
    },
    include: {
      rosterYears: {
        where: {
          isActive: true,
        },
        select: {
          members: {
            where: {
              isActive: true,
            },
            orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
            select: {
              id: true,
              firstName: true,
              lastName: true,
              memberRole: true,
              backgroundCheckCleared: true,
            },
          },
        },
        orderBy: {
          startsOn: "desc",
        },
        take: 1,
      },
    },
  });

  if (!club) {
    throw new Error("Club not found.");
  }

  const event = await prisma.event.findUnique({
    where: {
      id: input.eventId,
    },
    select: {
      id: true,
      name: true,
      workflowType: true,
      registrationOpensAt: true,
      registrationClosesAt: true,
      dynamicFields: {
        select: {
          key: true,
        },
      },
    },
  });

  if (!event || !isCamporeeWorkflowEvent(event)) {
    throw new Error("Camporee registration is not enabled for this event.");
  }

  const rosterMembers = club.rosterYears[0]?.members ?? [];
  const validAttendeeIds = new Set(rosterMembers.map((member) => member.id));

  return {
    event,
    club,
    directorEmail: input.directorEmail,
    rosterMembers,
    validAttendeeIds,
  };
}

async function requireDirectorCamporeeContext(eventId: string, clubIdOverride?: string | null) {
  const managedClub = await getManagedClubContext(clubIdOverride);

  return getCamporeeRegistrationContext({
    eventId,
    clubId: managedClub.clubId,
    directorEmail: managedClub.userEmail,
  });
}

async function persistCamporeeRegistrationForClub(input: {
  eventId: string;
  clubId: string;
  clubName: string;
  directorEmail: string | null;
  payload: CamporeeRegistrationPayload;
  nextStatus: RegistrationStatus;
}) {
  const context = await getCamporeeRegistrationContext({
    eventId: input.eventId,
    clubId: input.clubId,
    directorEmail: input.directorEmail,
  });

  const attendeeIds = input.payload.attendeeIds.filter((attendeeId) => context.validAttendeeIds.has(attendeeId));
  validateCamporeeRegistrationPayload(
    {
      ...input.payload,
      attendeeIds,
    },
    {
      requireCompleteSubmission: input.nextStatus === RegistrationStatus.SUBMITTED,
    },
  );

  const adultsMissingClearance = attendeeIds
    .map((attendeeId) => context.rosterMembers.find((member) => member.id === attendeeId))
    .filter((member): member is NonNullable<typeof member> => Boolean(member))
    .filter(
      (member) =>
        (member.memberRole === "STAFF" || member.memberRole === "DIRECTOR") &&
        !member.backgroundCheckCleared,
    )
    .map((member) => `${member.firstName} ${member.lastName}`);

  if (input.nextStatus === RegistrationStatus.SUBMITTED && adultsMissingClearance.length > 0) {
    throw new Error(
      `Registration blocked: Sterling Volunteers clearance is missing for ${adultsMissingClearance.join(", ")}.`,
    );
  }

  let emailWarning: string | null = null;

  await prisma.$transaction(async (tx) => {
    const existingRegistration = await tx.eventRegistration.findUnique({
      where: {
        eventId_clubId: {
          eventId: input.eventId,
          clubId: input.clubId,
        },
      },
      select: {
        id: true,
        status: true,
      },
    });

    assertRegistrationCanPersist({
      registrationOpensAt: context.event.registrationOpensAt,
      registrationClosesAt: context.event.registrationClosesAt,
      registrationStatus: existingRegistration?.status ?? null,
      now: new Date(),
    });

    const registration = existingRegistration
      ? await tx.eventRegistration.update({
          where: {
            id: existingRegistration.id,
          },
          data: {
            status: input.nextStatus,
            submittedAt: input.nextStatus === RegistrationStatus.SUBMITTED ? new Date() : null,
            approvedAt: input.nextStatus === RegistrationStatus.APPROVED ? new Date() : null,
          },
          select: {
            id: true,
          },
        })
      : await tx.eventRegistration.create({
          data: {
            eventId: input.eventId,
            clubId: input.clubId,
            registrationCode: generateRegistrationCode(),
            status: input.nextStatus,
            submittedAt: input.nextStatus === RegistrationStatus.SUBMITTED ? new Date() : null,
            approvedAt: input.nextStatus === RegistrationStatus.APPROVED ? new Date() : null,
            totalDue: 0,
            paymentStatus: PaymentStatus.PENDING,
          },
          select: {
            id: true,
          },
        });

    await tx.registrationAttendee.deleteMany({
      where: {
        eventRegistrationId: registration.id,
      },
    });

    if (attendeeIds.length > 0) {
      await tx.registrationAttendee.createMany({
        data: attendeeIds.map((rosterMemberId) => ({
          eventRegistrationId: registration.id,
          rosterMemberId,
        })),
      });
    }

    await tx.camporeeRegistration.upsert({
      where: {
        eventRegistrationId: registration.id,
      },
      update: {
        primaryContactName: input.payload.primaryContactName,
        primaryContactPhone: input.payload.primaryContactPhone,
        primaryContactEmail: input.payload.primaryContactEmail || null,
        secondaryContactName: input.payload.secondaryContactName || null,
        secondaryContactPhone: input.payload.secondaryContactPhone || null,
        campsiteType: input.payload.campsiteType,
        tentSummary: input.payload.tentSummary,
        trailerCount: input.payload.trailerCount,
        kitchenCanopyCount: input.payload.kitchenCanopyCount,
        squareFootageNeeded: input.payload.squareFootageNeeded,
        campNearRequest: input.payload.campNearRequest || null,
        campsiteNotes: input.payload.campsiteNotes || null,
        arrivalDateTime: input.payload.arrivalDateTime ? new Date(input.payload.arrivalDateTime) : null,
        departureDateTime: input.payload.departureDateTime ? new Date(input.payload.departureDateTime) : null,
        vehicleCount: input.payload.vehicleCount,
        transportSummary: input.payload.transportSummary || null,
        arrivalNotes: input.payload.arrivalNotes || null,
        mealPlan: input.payload.mealPlan,
        sabbathSupperCount: input.payload.sabbathSupperCount,
        sundayBreakfastCount: input.payload.sundayBreakfastCount,
        waterServiceNeeded: input.payload.waterServiceNeeded,
        foodPlanningNotes: input.payload.foodPlanningNotes || null,
        dietaryNotes: input.payload.dietaryNotes || null,
        dutyPreferences: input.payload.dutyPreferences,
        participationHighlights: input.payload.participationHighlights,
        firstAidCertifiedCount: input.payload.firstAidCertifiedCount,
        leadershipStaffCount: input.payload.leadershipStaffCount,
        emergencyContactName: input.payload.emergencyContactName,
        emergencyContactPhone: input.payload.emergencyContactPhone,
        emergencyMeetingPoint: input.payload.emergencyMeetingPoint || null,
        medicationStorageNotes: input.payload.medicationStorageNotes || null,
        emergencyNotes: input.payload.emergencyNotes || null,
        chaplainVisitRequested: input.payload.chaplainVisitRequested,
        worshipParticipationNotes: input.payload.worshipParticipationNotes || null,
        ministryDisplayNotes: input.payload.ministryDisplayNotes || null,
        finalReviewNotes: input.payload.finalReviewNotes || null,
      },
      create: {
        eventRegistrationId: registration.id,
        primaryContactName: input.payload.primaryContactName,
        primaryContactPhone: input.payload.primaryContactPhone,
        primaryContactEmail: input.payload.primaryContactEmail || null,
        secondaryContactName: input.payload.secondaryContactName || null,
        secondaryContactPhone: input.payload.secondaryContactPhone || null,
        campsiteType: input.payload.campsiteType,
        tentSummary: input.payload.tentSummary,
        trailerCount: input.payload.trailerCount,
        kitchenCanopyCount: input.payload.kitchenCanopyCount,
        squareFootageNeeded: input.payload.squareFootageNeeded,
        campNearRequest: input.payload.campNearRequest || null,
        campsiteNotes: input.payload.campsiteNotes || null,
        arrivalDateTime: input.payload.arrivalDateTime ? new Date(input.payload.arrivalDateTime) : null,
        departureDateTime: input.payload.departureDateTime ? new Date(input.payload.departureDateTime) : null,
        vehicleCount: input.payload.vehicleCount,
        transportSummary: input.payload.transportSummary || null,
        arrivalNotes: input.payload.arrivalNotes || null,
        mealPlan: input.payload.mealPlan,
        sabbathSupperCount: input.payload.sabbathSupperCount,
        sundayBreakfastCount: input.payload.sundayBreakfastCount,
        waterServiceNeeded: input.payload.waterServiceNeeded,
        foodPlanningNotes: input.payload.foodPlanningNotes || null,
        dietaryNotes: input.payload.dietaryNotes || null,
        dutyPreferences: input.payload.dutyPreferences,
        participationHighlights: input.payload.participationHighlights,
        firstAidCertifiedCount: input.payload.firstAidCertifiedCount,
        leadershipStaffCount: input.payload.leadershipStaffCount,
        emergencyContactName: input.payload.emergencyContactName,
        emergencyContactPhone: input.payload.emergencyContactPhone,
        emergencyMeetingPoint: input.payload.emergencyMeetingPoint || null,
        medicationStorageNotes: input.payload.medicationStorageNotes || null,
        emergencyNotes: input.payload.emergencyNotes || null,
        chaplainVisitRequested: input.payload.chaplainVisitRequested,
        worshipParticipationNotes: input.payload.worshipParticipationNotes || null,
        ministryDisplayNotes: input.payload.ministryDisplayNotes || null,
        finalReviewNotes: input.payload.finalReviewNotes || null,
      },
    });
  });

  revalidatePath(`/director/events/${input.eventId}`);
  revalidatePath("/director/dashboard");
  revalidatePath(`/admin/events/${input.eventId}`);
  revalidatePath(`/admin/events/${input.eventId}/camporee`);

  if (input.nextStatus === RegistrationStatus.SUBMITTED && input.directorEmail) {
    try {
      await sendRegistrationReceiptEmail({
        to: input.directorEmail,
        clubName: input.clubName,
        eventName: context.event.name,
        attendeeCount: attendeeIds.length,
      });
    } catch (error) {
      console.error("Camporee registration saved, but receipt email failed.", error);
      emailWarning = "Camporee registration submitted, but the confirmation email could not be sent.";
    }
  }

  return { emailWarning };
}

export async function saveCamporeeRegistrationDraft(
  _prevState: CamporeeRegistrationActionState,
  formData: FormData,
): Promise<CamporeeRegistrationActionState> {
  try {
    const eventId = requireTrimmedString(formData.get("eventId"), "Event");
    const payload = parseCamporeeRegistrationPayload(formData.get("camporeePayload"));
    const clubIdValue = formData.get("clubId");
    const context = await requireDirectorCamporeeContext(
      eventId,
      typeof clubIdValue === "string" ? clubIdValue : null,
    );

    await persistCamporeeRegistrationForClub({
      eventId,
      clubId: context.club.id,
      clubName: context.club.name,
      directorEmail: context.directorEmail,
      payload,
      nextStatus: RegistrationStatus.DRAFT,
    });

    return {
      status: "success",
      message: "Camporee draft saved.",
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to save Camporee draft.",
    };
  }
}

export async function submitCamporeeRegistration(
  _prevState: CamporeeRegistrationActionState,
  formData: FormData,
): Promise<CamporeeRegistrationActionState> {
  try {
    const eventId = requireTrimmedString(formData.get("eventId"), "Event");
    const payload = parseCamporeeRegistrationPayload(formData.get("camporeePayload"));
    const clubIdValue = formData.get("clubId");
    const context = await requireDirectorCamporeeContext(
      eventId,
      typeof clubIdValue === "string" ? clubIdValue : null,
    );

    const result = await persistCamporeeRegistrationForClub({
      eventId,
      clubId: context.club.id,
      clubName: context.club.name,
      directorEmail: context.directorEmail,
      payload,
      nextStatus: RegistrationStatus.SUBMITTED,
    });

    return {
      status: "success",
      message: result.emailWarning ?? "Camporee registration submitted.",
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to submit Camporee registration.",
    };
  }
}

export async function updateCamporeeRegistrationStatus(formData: FormData) {
  const session = await auth();

  if (!session?.user || session.user.role !== UserRole.SUPER_ADMIN) {
    throw new Error("Only super admins can manage Camporee registrations.");
  }

  const eventRegistrationId = requireTrimmedString(formData.get("eventRegistrationId"), "Registration");
  const eventId = requireTrimmedString(formData.get("eventId"), "Event");
  const nextStatus = requireTrimmedString(formData.get("nextStatus"), "Next status") as RegistrationStatus;
  const reviewerNotes = normalizeReviewerText(formData.get("reviewerNotes"));
  const revisionRequestedReason =
    nextStatus === RegistrationStatus.NEEDS_CHANGES
      ? requireRevisionReason(formData.get("revisionRequestedReason"))
      : normalizeReviewerText(formData.get("revisionRequestedReason"));

  if (
    nextStatus !== RegistrationStatus.REVIEWED &&
    nextStatus !== RegistrationStatus.NEEDS_CHANGES &&
    nextStatus !== RegistrationStatus.APPROVED
  ) {
    throw new Error("Unsupported Camporee registration status.");
  }

  const registration = await prisma.eventRegistration.findUnique({
    where: {
      id: eventRegistrationId,
    },
    select: {
      status: true,
      camporeeRegistration: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!registration?.camporeeRegistration) {
    throw new Error("Camporee registration not found.");
  }

  if (registration.status === RegistrationStatus.DRAFT) {
    throw new Error("Draft Camporee registrations must be submitted before admin review.");
  }

  await prisma.eventRegistration.update({
    where: {
      id: eventRegistrationId,
    },
    data: {
      status: nextStatus,
      approvedAt: nextStatus === RegistrationStatus.APPROVED ? new Date() : null,
      reviewedAt: new Date(),
      reviewedByUserId: session.user.id,
      reviewerNotes,
      revisionRequestedReason: nextStatus === RegistrationStatus.NEEDS_CHANGES ? revisionRequestedReason : null,
    },
  });

  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath(`/admin/events/${eventId}/camporee`);
  revalidatePath(`/director/events/${eventId}`);
}

export async function getCamporeeOperationsDashboard(eventId: string) {
  await requireSuperAdmin();

  const event = await prisma.event.findUnique({
    where: {
      id: eventId,
    },
    select: {
      id: true,
      name: true,
      workflowType: true,
      dynamicFields: {
        select: {
          key: true,
        },
      },
      registrations: {
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
        include: {
          club: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          attendees: {
            select: {
              rosterMember: {
                select: {
                  firstName: true,
                  lastName: true,
                  memberRole: true,
                },
              },
            },
          },
          camporeeRegistration: true,
          reviewedByUser: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!event || !isCamporeeWorkflowEvent(event)) {
    return null;
  }

  const registrations = event.registrations.filter((registration) => registration.camporeeRegistration !== null);
  const totals = {
    clubs: registrations.length,
    attendees: registrations.reduce((sum, registration) => sum + registration.attendees.length, 0),
    waitForReview: registrations.filter((registration) => registration.status === RegistrationStatus.SUBMITTED).length,
    approved: registrations.filter((registration) => registration.status === RegistrationStatus.APPROVED).length,
    squareFootage: registrations.reduce(
      (sum, registration) => sum + (registration.camporeeRegistration?.squareFootageNeeded ?? 0),
      0,
    ),
  };

  return {
    event,
    totals,
    registrations,
  };
}

export async function getDirectorCamporeeRegistrationSnapshot(eventId: string, clubIdOverride?: string | null) {
  const context = await requireDirectorCamporeeContext(eventId, clubIdOverride);

  const registration = await prisma.eventRegistration.findUnique({
    where: {
      eventId_clubId: {
        eventId,
        clubId: context.club.id,
      },
    },
    include: {
      attendees: {
        select: {
          rosterMemberId: true,
        },
      },
      camporeeRegistration: true,
    },
  });

  return {
    club: context.club,
    rosterMembers: context.rosterMembers,
      registrationStatus: registration?.status ?? null,
      reviewerNotes: registration?.reviewerNotes ?? null,
      revisionRequestedReason: registration?.revisionRequestedReason ?? null,
      existingPayload: registration?.camporeeRegistration
      ? {
          attendeeIds: registration.attendees.map((attendee) => attendee.rosterMemberId),
          primaryContactName: registration.camporeeRegistration.primaryContactName,
          primaryContactPhone: registration.camporeeRegistration.primaryContactPhone,
          primaryContactEmail: registration.camporeeRegistration.primaryContactEmail ?? "",
          secondaryContactName: registration.camporeeRegistration.secondaryContactName ?? "",
          secondaryContactPhone: registration.camporeeRegistration.secondaryContactPhone ?? "",
          campsiteType: registration.camporeeRegistration.campsiteType,
          tentSummary: registration.camporeeRegistration.tentSummary,
          trailerCount: registration.camporeeRegistration.trailerCount,
          kitchenCanopyCount: registration.camporeeRegistration.kitchenCanopyCount,
          squareFootageNeeded: registration.camporeeRegistration.squareFootageNeeded,
          campNearRequest: registration.camporeeRegistration.campNearRequest ?? "",
          campsiteNotes: registration.camporeeRegistration.campsiteNotes ?? "",
          arrivalDateTime: registration.camporeeRegistration.arrivalDateTime?.toISOString().slice(0, 16) ?? "",
          departureDateTime: registration.camporeeRegistration.departureDateTime?.toISOString().slice(0, 16) ?? "",
          vehicleCount: registration.camporeeRegistration.vehicleCount,
          transportSummary: registration.camporeeRegistration.transportSummary ?? "",
          arrivalNotes: registration.camporeeRegistration.arrivalNotes ?? "",
          mealPlan: registration.camporeeRegistration.mealPlan,
          sabbathSupperCount: registration.camporeeRegistration.sabbathSupperCount,
          sundayBreakfastCount: registration.camporeeRegistration.sundayBreakfastCount,
          waterServiceNeeded: registration.camporeeRegistration.waterServiceNeeded,
          foodPlanningNotes: registration.camporeeRegistration.foodPlanningNotes ?? "",
          dietaryNotes: registration.camporeeRegistration.dietaryNotes ?? "",
          dutyPreferences: registration.camporeeRegistration.dutyPreferences,
          participationHighlights: registration.camporeeRegistration.participationHighlights,
          firstAidCertifiedCount: registration.camporeeRegistration.firstAidCertifiedCount,
          leadershipStaffCount: registration.camporeeRegistration.leadershipStaffCount,
          emergencyContactName: registration.camporeeRegistration.emergencyContactName,
          emergencyContactPhone: registration.camporeeRegistration.emergencyContactPhone,
          emergencyMeetingPoint: registration.camporeeRegistration.emergencyMeetingPoint ?? "",
          medicationStorageNotes: registration.camporeeRegistration.medicationStorageNotes ?? "",
          emergencyNotes: registration.camporeeRegistration.emergencyNotes ?? "",
          chaplainVisitRequested: registration.camporeeRegistration.chaplainVisitRequested,
          worshipParticipationNotes: registration.camporeeRegistration.worshipParticipationNotes ?? "",
          ministryDisplayNotes: registration.camporeeRegistration.ministryDisplayNotes ?? "",
          finalReviewNotes: registration.camporeeRegistration.finalReviewNotes ?? "",
        }
      : EMPTY_CAMPOREE_REGISTRATION,
  };
}
