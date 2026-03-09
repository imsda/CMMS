"use server";

import { MemberRole, PaymentStatus, RegistrationStatus, type Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "../../auth";
import { sendRegistrationReceiptEmail } from "../../lib/email/resend";
import { normalizeResponsesForPersistence, type DynamicFieldRule } from "../../lib/event-form-response-utils";
import { prisma } from "../../lib/prisma";
import { assertRegistrationWindow } from "../../lib/registration-window";

export type RegistrationActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

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

function parseStringOptions(options: unknown) {
  if (!Array.isArray(options)) {
    return [];
  }

  return options.filter((option): option is string => typeof option === "string");
}

function hasResponseValue(value: unknown) {
  if (value === null || typeof value === "undefined") {
    return false;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return true;
}

function validateResponseValue(
  field: DynamicFieldRule,
  value: unknown,
  validAttendeeIds: Set<string>,
) {
  if (!hasResponseValue(value)) {
    return;
  }

  if (field.type === "BOOLEAN" && typeof value !== "boolean") {
    throw new Error(`"${field.label}" must be true or false.`);
  }

  if (field.type === "NUMBER" && (typeof value !== "number" || Number.isNaN(value))) {
    throw new Error(`"${field.label}" must be a valid number.`);
  }

  if (field.type === "DATE") {
    if (typeof value !== "string") {
      throw new Error(`"${field.label}" must be a valid date.`);
    }

    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      throw new Error(`"${field.label}" must be a valid date.`);
    }
  }

  if (
    field.type === "SHORT_TEXT" ||
    field.type === "LONG_TEXT" ||
    field.type === "SINGLE_SELECT" ||
    field.type === "ROSTER_SELECT"
  ) {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error(`"${field.label}" must be a non-empty value.`);
    }
  }

  if (field.type === "MULTI_SELECT" || field.type === "ROSTER_MULTI_SELECT") {
    if (!Array.isArray(value) || value.length === 0 || !value.every((entry) => typeof entry === "string")) {
      throw new Error(`"${field.label}" must include at least one selection.`);
    }
  }

  if (field.type === "SINGLE_SELECT") {
    const options = new Set(parseStringOptions(field.options));
    if (options.size > 0 && typeof value === "string" && !options.has(value)) {
      throw new Error(`"${field.label}" has an invalid selection.`);
    }
  }

  if (field.type === "MULTI_SELECT") {
    const options = new Set(parseStringOptions(field.options));
    if (options.size > 0 && Array.isArray(value) && value.some((entry) => !options.has(entry as string))) {
      throw new Error(`"${field.label}" has one or more invalid selections.`);
    }
  }

  if (field.type === "ROSTER_SELECT") {
    if (typeof value === "string" && !validAttendeeIds.has(value)) {
      throw new Error(`"${field.label}" must reference a valid roster member.`);
    }
  }

  if (field.type === "ROSTER_MULTI_SELECT") {
    if (Array.isArray(value) && value.some((entry) => typeof entry !== "string" || !validAttendeeIds.has(entry))) {
      throw new Error(`"${field.label}" contains an invalid roster member.`);
    }
  }
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
      basePrice: true,
      lateFeePrice: true,
      lateFeeStartsAt: true,
      registrationOpensAt: true,
      registrationClosesAt: true,
      dynamicFields: {
        select: {
          id: true,
          key: true,
          label: true,
          type: true,
          isRequired: true,
          description: true,
          options: true,
        },
      },
    },
  });

  if (!event) {
    throw new Error("Event not found.");
  }

  const activeRoster = membership.club.rosterYears[0];
  const rosterMembers = activeRoster?.members ?? [];
  const validAttendeeIds = new Set(rosterMembers.map((member) => member.id));
  const validFieldIds = new Set(event.dynamicFields.map((field) => field.id));
  const dynamicFieldRules = event.dynamicFields.filter((field) => field.type !== "FIELD_GROUP");

  return {
    event,
    clubId: membership.club.id,
    clubName: membership.club.name,
    directorEmail: membership.user.email ?? session.user.email ?? null,
    rosterMembers,
    validAttendeeIds,
    validFieldIds,
    dynamicFieldRules,
  };
}

async function persistRegistration(formData: FormData, nextStatus: RegistrationStatus): Promise<{ emailWarning: string | null }> {
  const eventIdEntry = formData.get("eventId");
  if (typeof eventIdEntry !== "string" || eventIdEntry.trim().length === 0) {
    throw new Error("Event id is required.");
  }

  const eventId = eventIdEntry.trim();
  const payload = parsePayload(formData.get("registrationPayload"));

  const {
    clubId,
    clubName,
    directorEmail,
    event,
    rosterMembers,
    validAttendeeIds,
    validFieldIds,
    dynamicFieldRules,
  } = await requireDirectorClubForEvent(eventId);

  const attendeeIds = payload.attendeeIds.filter((attendeeId) => validAttendeeIds.has(attendeeId));
  const attendeeIdSet = new Set(attendeeIds);

  const responses = normalizeResponsesForPersistence({
    responses: payload.responses,
    dynamicFieldRules,
    validFieldIds,
    attendeeIdSet,
  });

  const responseByFieldId = new Map<string, unknown>();
  for (const response of responses) {
    if (!responseByFieldId.has(response.eventFormFieldId)) {
      responseByFieldId.set(response.eventFormFieldId, response.value);
    }
  }

  if (nextStatus === RegistrationStatus.SUBMITTED) {
    assertRegistrationWindow(new Date(), event.registrationOpensAt, event.registrationClosesAt);

    if (attendeeIds.length === 0) {
      throw new Error("Select at least one attendee before submitting registration.");
    }

    for (const field of dynamicFieldRules) {
      const responseValue = responseByFieldId.get(field.id);

      if (field.isRequired && !hasResponseValue(responseValue)) {
        throw new Error(`Required question is missing: "${field.label}".`);
      }

      validateResponseValue(field, responseValue, validAttendeeIds);
    }
  }


  if (nextStatus === RegistrationStatus.SUBMITTED) {
    const attendeeLookup = new Map(rosterMembers.map((member) => [member.id, member]));
    const adultsMissingClearance = attendeeIds
      .map((attendeeId) => attendeeLookup.get(attendeeId))
      .filter((member): member is NonNullable<typeof member> => Boolean(member))
      .filter(
        (member) =>
          (member.memberRole === MemberRole.STAFF || member.memberRole === MemberRole.DIRECTOR) &&
          !member.backgroundCheckCleared,
      )
      .map((member) => `${member.firstName} ${member.lastName}`);

    if (adultsMissingClearance.length > 0) {
      throw new Error(
        `Registration blocked: Sterling Volunteers clearance is missing for ${adultsMissingClearance.join(", ")}.`,
      );
    }
  }
  const now = new Date();
  const pricePerAttendee = now >= event.lateFeeStartsAt ? event.lateFeePrice : event.basePrice;
  const totalDue = attendeeIds.length * pricePerAttendee;

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
        totalDue,
        paymentStatus: totalDue <= 0 ? PaymentStatus.PAID : PaymentStatus.PENDING,
      },
      update: {
        status: nextStatus,
        submittedAt: nextStatus === RegistrationStatus.SUBMITTED ? new Date() : null,
        totalDue,
        paymentStatus: totalDue <= 0 ? PaymentStatus.PAID : PaymentStatus.PENDING,
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
          value: response.value as Prisma.InputJsonValue,
        })),
      });
    }
  });

  revalidatePath(`/director/events/${eventId}`);
  revalidatePath("/director/dashboard");

  let emailWarning: string | null = null;
  if (nextStatus === RegistrationStatus.SUBMITTED && directorEmail) {
    try {
      await sendRegistrationReceiptEmail({
        to: directorEmail,
        clubName,
        eventName: event.name,
        attendeeCount: attendeeIds.length,
      });
    } catch {
      emailWarning = "Registration submitted, but receipt email could not be sent.";
    }
  }

  return { emailWarning };
}

export async function saveEventRegistrationDraft(
  _prevState: RegistrationActionState,
  formData: FormData,
): Promise<RegistrationActionState> {
  try {
    await persistRegistration(formData, RegistrationStatus.DRAFT);
    return {
      status: "success",
      message: "Draft saved.",
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to save draft.",
    };
  }
}

export async function submitEventRegistration(
  _prevState: RegistrationActionState,
  formData: FormData,
): Promise<RegistrationActionState> {
  try {
    const result = await persistRegistration(formData, RegistrationStatus.SUBMITTED);
    return {
      status: "success",
      message: result.emailWarning ?? "Registration submitted.",
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to submit registration.",
    };
  }
}
