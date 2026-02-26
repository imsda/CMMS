"use server";

import { RegistrationStatus, type Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "../../auth";
import { sendRegistrationReceiptEmail } from "../../lib/email/resend";
import { prisma } from "../../lib/prisma";

type RegistrationPayload = {
  attendeeIds: string[];
  responses: Array<{
    fieldId: string;
    attendeeId: string | null;
    value: Prisma.InputJsonValue;
  }>;
};

function generateRegistrationCode() {
  return `REG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function parsePayload(rawPayload: FormDataEntryValue | null): RegistrationPayload {
  if (typeof rawPayload !== "string" || rawPayload.trim().length === 0) {
    throw new Error("Registration payload is required.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawPayload);
  } catch {
    throw new Error("Registration payload is invalid JSON.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Registration payload is malformed.");
  }

  const candidate = parsed as RegistrationPayload;
  const attendeeIds = Array.isArray(candidate.attendeeIds)
    ? candidate.attendeeIds.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];

  const responses = Array.isArray(candidate.responses)
    ? candidate.responses.filter(
        (response): response is RegistrationPayload["responses"][number] =>
          Boolean(response) &&
          typeof response.fieldId === "string" &&
          response.fieldId.length > 0 &&
          (typeof response.attendeeId === "string" || response.attendeeId === null),
      )
    : [];

  return {
    attendeeIds: [...new Set(attendeeIds)],
    responses,
  };
}

async function requireDirectorClubForEvent(eventId: string) {
  const session = await auth();

  if (!session?.user || session.user.role !== "CLUB_DIRECTOR") {
    throw new Error("Only club directors can register for events.");
  }

  const membership = await prisma.clubMembership.findFirst({
    where: {
      userId: session.user.id,
    },
    include: {
      user: {
        select: {
          email: true,
        },
      },
      club: {
        select: {
          id: true,
          name: true,
          rosterYears: {
            where: {
              isActive: true,
            },
            include: {
              members: {
                where: {
                  isActive: true,
                },
                select: {
                  id: true,
                },
              },
            },
            orderBy: {
              startsOn: "desc",
            },
            take: 1,
          },
        },
      },
    },
    orderBy: {
      isPrimary: "desc",
    },
  });

  if (!membership?.club) {
    throw new Error("No club membership was found for this director.");
  }

  const event = await prisma.event.findUnique({
    where: {
      id: eventId,
    },
    select: {
      id: true,
      name: true,
      dynamicFields: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!event) {
    throw new Error("Event not found.");
  }

  const activeRoster = membership.club.rosterYears[0];
  const validAttendeeIds = new Set(activeRoster?.members.map((member) => member.id) ?? []);
  const validFieldIds = new Set(event.dynamicFields.map((field) => field.id));

  return {
    event,
    clubId: membership.club.id,
    clubName: membership.club.name,
    directorEmail: membership.user.email ?? session.user.email ?? null,
    validAttendeeIds,
    validFieldIds,
  };
}

async function persistRegistration(formData: FormData, nextStatus: RegistrationStatus) {
  const eventIdEntry = formData.get("eventId");
  if (typeof eventIdEntry !== "string" || eventIdEntry.trim().length === 0) {
    throw new Error("Event id is required.");
  }

  const eventId = eventIdEntry.trim();
  const payload = parsePayload(formData.get("registrationPayload"));

  const { clubId, clubName, directorEmail, event, validAttendeeIds, validFieldIds } = await requireDirectorClubForEvent(eventId);

  const attendeeIds = payload.attendeeIds.filter((attendeeId) => validAttendeeIds.has(attendeeId));
  const attendeeIdSet = new Set(attendeeIds);

  const responses = payload.responses
    .filter((response) => {
      if (!validFieldIds.has(response.fieldId)) {
        return false;
      }

      if (response.attendeeId === null) {
        return true;
      }

      return attendeeIdSet.has(response.attendeeId);
    })
    .map((response) => ({
      eventFormFieldId: response.fieldId,
      attendeeId: response.attendeeId,
      value: response.value,
    }));

  await prisma.$transaction(async (tx) => {
    const registration = await tx.eventRegistration.upsert({
      where: {
        eventId_clubId: {
          eventId,
          clubId,
        },
      },
      create: {
        eventId,
        clubId,
        registrationCode: generateRegistrationCode(),
        status: nextStatus,
        submittedAt: nextStatus === RegistrationStatus.SUBMITTED ? new Date() : null,
      },
      update: {
        status: nextStatus,
        submittedAt: nextStatus === RegistrationStatus.SUBMITTED ? new Date() : null,
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

    await tx.eventFormResponse.deleteMany({
      where: {
        eventRegistrationId: registration.id,
      },
    });

    if (responses.length > 0) {
      await tx.eventFormResponse.createMany({
        data: responses.map((response) => ({
          eventRegistrationId: registration.id,
          eventFormFieldId: response.eventFormFieldId,
          attendeeId: response.attendeeId,
          value: response.value,
        })),
      });
    }
  });

  revalidatePath(`/director/events/${eventId}`);
  revalidatePath("/director/dashboard");

  if (nextStatus === RegistrationStatus.SUBMITTED && directorEmail) {
    await sendRegistrationReceiptEmail({
      to: directorEmail,
      clubName,
      eventName: event.name,
      attendeeCount: attendeeIds.length,
    });
  }
}

export async function saveEventRegistrationDraft(formData: FormData) {
  await persistRegistration(formData, RegistrationStatus.DRAFT);
}

export async function submitEventRegistration(formData: FormData) {
  await persistRegistration(formData, RegistrationStatus.SUBMITTED);
}
