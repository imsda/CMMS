"use server";

import { FormFieldScope, RegistrationStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { type Session } from "next-auth";

import { auth } from "../../auth";
import { getMissingRequiredFieldLabels } from "../../lib/event-form-completeness";
import { prisma } from "../../lib/prisma";
import { assertRegistrationCanBeCheckedIn } from "../../lib/registration-lifecycle";

function ensureSuperAdmin(session: Session | null) {
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    throw new Error("Only super admins can perform this action.");
  }
}

function requireTrimmedString(value: FormDataEntryValue | null, label: string) {
  if (typeof value !== "string") {
    throw new Error(`${label} is required.`);
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new Error(`${label} is required.`);
  }

  return trimmed;
}

export async function getEventCheckinDashboard(eventId: string) {
  const session = await auth();
  ensureSuperAdmin(session);

  const event = await prisma.event.findUnique({
    where: {
      id: eventId,
    },
    select: {
      id: true,
      name: true,
      startsAt: true,
      endsAt: true,
      dynamicFields: {
        where: {
          isRequired: true,
        },
        orderBy: {
          sortOrder: "asc",
        },
        select: {
          id: true,
          key: true,
          label: true,
          description: true,
          fieldScope: true,
          options: true,
        },
      },
      registrations: {
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          registrationCode: true,
          status: true,
          submittedAt: true,
          approvedAt: true,
          club: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          attendees: {
            orderBy: {
              createdAt: "asc",
            },
            select: {
              id: true,
              checkedInAt: true,
              rosterMemberId: true,
              rosterMember: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          formResponses: {
            select: {
              attendeeId: true,
              eventFormFieldId: true,
            },
          },
        },
      },
    },
  });

  if (!event) {
    return null;
  }

  const registrations = event.registrations.map((registration) => {
    const missingRequiredFields = getMissingRequiredFieldLabels({
      requiredFields: event.dynamicFields,
      attendees: registration.attendees,
      formResponses: registration.formResponses,
    });

    const checkedInCount = registration.attendees.filter((attendee) => attendee.checkedInAt !== null).length;

    return {
      ...registration,
      checkedInCount,
      missingRequiredFields,
      hasMissingRequiredFields: missingRequiredFields.length > 0,
    };
  });

  return {
    ...event,
    registrations,
  };
}

export async function markRegistrationCheckedIn(formData: FormData) {
  const session = await auth();
  ensureSuperAdmin(session);

  const eventId = requireTrimmedString(formData.get("eventId"), "Event");
  const registrationId = requireTrimmedString(formData.get("registrationId"), "Registration");

  await approveRegistrationForCheckIn(eventId, registrationId);

  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath(`/admin/events/${eventId}/checkin`);
}

export async function approveRegistrationForCheckIn(eventId: string, registrationId: string) {

  await prisma.$transaction(async (tx) => {
    const registration = await tx.eventRegistration.findUnique({
      where: {
        id: registrationId,
      },
      select: {
        id: true,
        eventId: true,
        status: true,
        attendees: {
          select: {
            rosterMemberId: true,
          },
        },
        formResponses: {
          select: {
            attendeeId: true,
            eventFormFieldId: true,
          },
        },
        event: {
          select: {
            dynamicFields: {
              where: {
                isRequired: true,
              },
              orderBy: {
                sortOrder: "asc",
              },
              select: {
                id: true,
                key: true,
                label: true,
                description: true,
                fieldScope: true,
                options: true,
              },
            },
          },
        },
      },
    });

    if (!registration || registration.eventId !== eventId) {
      throw new Error("Registration not found for this event.");
    }

    assertRegistrationCanBeCheckedIn(registration.status);

    const missingRequiredFields = getMissingRequiredFieldLabels({
      requiredFields: registration.event.dynamicFields,
      attendees: registration.attendees,
      formResponses: registration.formResponses,
    });

    if (missingRequiredFields.length > 0) {
      throw new Error(
        `Check-in blocked: required registration fields are incomplete. Missing: ${missingRequiredFields.join(", ")}.`,
      );
    }

    const checkedInAt = new Date();

    await tx.registrationAttendee.updateMany({
      where: {
        eventRegistrationId: registrationId,
        checkedInAt: null,
      },
      data: {
        checkedInAt,
      },
    });

    await tx.eventRegistration.update({
      where: {
        id: registrationId,
      },
      data: {
        status: RegistrationStatus.APPROVED,
        approvedAt: checkedInAt,
      },
    });
  });
}
