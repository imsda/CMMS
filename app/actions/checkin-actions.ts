"use server";

import { RegistrationStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "../../auth";
import { prisma } from "../../lib/prisma";

function ensureSuperAdmin(session: Awaited<ReturnType<typeof auth>>) {
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

function isAttendeeSpecificField(field: {
  key: string;
  description: string | null;
  options: unknown;
}) {
  if (field.key.startsWith("attendee_") || field.key.startsWith("member_")) {
    return true;
  }

  if (typeof field.description === "string" && field.description.toLowerCase().includes("[attendee]")) {
    return true;
  }

  if (field.options && typeof field.options === "object" && !Array.isArray(field.options)) {
    const metadata = field.options as Record<string, unknown>;
    return metadata.attendeeSpecific === true || metadata.scope === "ATTENDEE";
  }

  if (Array.isArray(field.options)) {
    return field.options.includes("__ATTENDEE_LIST__");
  }

  return false;
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

  const requiredGlobalFields = event.dynamicFields.filter((field) => !isAttendeeSpecificField(field));
  const requiredAttendeeFields = event.dynamicFields.filter((field) => isAttendeeSpecificField(field));

  const registrations = event.registrations.map((registration) => {
    const globalResponses = new Set(
      registration.formResponses
        .filter((response) => response.attendeeId === null)
        .map((response) => response.eventFormFieldId),
    );

    const attendeeResponsesByField = registration.formResponses.reduce<Record<string, Set<string>>>((map, response) => {
      if (!response.attendeeId) {
        return map;
      }

      if (!map[response.eventFormFieldId]) {
        map[response.eventFormFieldId] = new Set();
      }

      map[response.eventFormFieldId].add(response.attendeeId);
      return map;
    }, {});

    const missingRequiredFields: string[] = [];

    for (const field of requiredGlobalFields) {
      if (!globalResponses.has(field.id)) {
        missingRequiredFields.push(field.label);
      }
    }

    for (const field of requiredAttendeeFields) {
      const responsesForField = attendeeResponsesByField[field.id] ?? new Set<string>();
      const missingAttendeeCount = registration.attendees.reduce((count, attendee) => {
        if (responsesForField.has(attendee.rosterMemberId)) {
          return count;
        }

        return count + 1;
      }, 0);

      if (missingAttendeeCount > 0) {
        missingRequiredFields.push(`${field.label} (${missingAttendeeCount} attendee${missingAttendeeCount > 1 ? "s" : ""})`);
      }
    }

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

  await prisma.$transaction(async (tx) => {
    const registration = await tx.eventRegistration.findUnique({
      where: {
        id: registrationId,
      },
      select: {
        id: true,
        eventId: true,
      },
    });

    if (!registration || registration.eventId !== eventId) {
      throw new Error("Registration not found for this event.");
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

  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath(`/admin/events/${eventId}/checkin`);
}
