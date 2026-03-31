"use server";

import { FormFieldScope, MemberRole, MemberStatus, PaymentStatus, RegistrationStatus, type Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { getManagedClubContext } from "../../lib/club-management";
import { sendRegistrationConfirmationEmail } from "../../lib/email/resend";
import { getEventRegistrationExportDataById } from "../../lib/data/event-registration-export";
import {
  EventRegistrationPdfDocument,
  generateAttendeeQrCodes,
} from "../../lib/pdf/event-registration-pdf";
import { isEventFieldVisible, readEventFieldConfig } from "../../lib/event-form-config";
import { getFieldScope } from "../../lib/event-form-scope";
import { getEventModeConfig } from "../../lib/event-modes";
import { createCheckoutLink } from "../../lib/payments/square";
import { prisma } from "../../lib/prisma";
import { generateRegistrationCode } from "../../lib/registration-code";
import { assertRegistrationCanPersist } from "../../lib/registration-lifecycle";

export type RegistrationActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
  checkoutUrl?: string | null;
  eligibilityWarnings?: string[];
};

type RegistrationPayload = {
  attendeeIds: string[];
  responses: Array<{
    fieldId: string;
    attendeeId: string | null;
    value: Prisma.InputJsonValue;
  }>;
};

type DynamicFieldRule = {
  id: string;
  key: string;
  label: string;
  type: string;
  fieldScope: FormFieldScope;
  isRequired: boolean;
  options: unknown;
};

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
  return readEventFieldConfig(options).optionValues;
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

async function getClubRegistrationContext(input: {
  eventId: string;
  clubId: string;
  directorEmail: string | null;
}) {
  const membershipClub = await prisma.club.findUnique({
    where: {
      id: input.clubId,
    },
    select: {
      id: true,
      name: true,
      type: true,
      rosterYears: {
        where: {
          isActive: true,
        },
        select: {
          members: {
            where: {
              isActive: true,
            },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              memberRole: true,
              memberStatus: true,
              backgroundCheckCleared: true,
              ageAtStart: true,
              dateOfBirth: true,
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

  if (!membershipClub) {
    throw new Error("No club was found for this registration.");
  }

  const event = await prisma.event.findUnique({
    where: {
      id: input.eventId,
    },
    select: {
      id: true,
      name: true,
      eventMode: true,
      startsAt: true,
      endsAt: true,
      locationName: true,
      locationAddress: true,
      basePrice: true,
      lateFeePrice: true,
      lateFeeStartsAt: true,
      registrationOpensAt: true,
      registrationClosesAt: true,
      minAttendeeAge: true,
      maxAttendeeAge: true,
      allowedClubTypes: true,
      dynamicFields: {
        select: {
          id: true,
          key: true,
          label: true,
          type: true,
          fieldScope: true,
          isRequired: true,
          options: true,
        },
      },
    },
  });

  if (!event) {
    throw new Error("Event not found.");
  }

  const activeRoster = membershipClub.rosterYears[0];
  const rosterMembers = activeRoster?.members ?? [];
  const validAttendeeIds = new Set(rosterMembers.map((member) => member.id));
  const validFieldIds = new Set(event.dynamicFields.map((field) => field.id));
  const dynamicFieldRules = event.dynamicFields.filter((field) => field.type !== "FIELD_GROUP");

  return {
    event,
    clubId: membershipClub.id,
    clubName: membershipClub.name,
    clubType: membershipClub.type,
    directorEmail: input.directorEmail,
    rosterMembers,
    validAttendeeIds,
    validFieldIds,
    dynamicFieldRules,
  };
}

async function requireDirectorClubForEvent(eventId: string, clubIdOverride?: string | null) {
  const managedClub = await getManagedClubContext(clubIdOverride);

  return getClubRegistrationContext({
    eventId,
    clubId: managedClub.clubId,
    directorEmail: managedClub.userEmail,
  });
}

function readManagedClubIdFromFormData(formData: FormData) {
  const clubId = formData.get("clubId");
  return typeof clubId === "string" && clubId.trim().length > 0 ? clubId.trim() : null;
}

export async function persistRegistrationForClub(input: {
  eventId: string;
  clubId: string;
  clubName: string;
  directorEmail: string | null;
  payload: RegistrationPayload;
  nextStatus: RegistrationStatus;
  now?: Date;
  sendConfirmationEmail?: typeof sendRegistrationConfirmationEmail;
}) {
  const {
    event,
    clubType,
    rosterMembers,
    validAttendeeIds,
    validFieldIds,
    dynamicFieldRules,
  } = await getClubRegistrationContext({
    eventId: input.eventId,
    clubId: input.clubId,
    directorEmail: input.directorEmail,
  });

  const attendeeIds = input.payload.attendeeIds.filter((attendeeId) => validAttendeeIds.has(attendeeId));
  const attendeeIdSet = new Set(attendeeIds);
  const eventModeConfig = getEventModeConfig(event.eventMode);

  if (!eventModeConfig.allowsRosterAttendees && attendeeIds.length > 0) {
    throw new Error("This event does not accept roster attendees.");
  }

  const fieldById = new Map(dynamicFieldRules.map((field) => [field.id, field]));

  const responses = input.payload.responses
    .filter((response) => {
      const field = fieldById.get(response.fieldId);
      if (!field || !validFieldIds.has(response.fieldId)) {
        return false;
      }

      const fieldScope = getFieldScope(field);
      if (fieldScope === FormFieldScope.GLOBAL) {
        return response.attendeeId === null;
      }

      return response.attendeeId !== null && attendeeIdSet.has(response.attendeeId);
    })
    .map((response) => ({
      eventFormFieldId: response.fieldId,
      attendeeId: response.attendeeId,
      value: response.value,
    }));

  const globalResponseByFieldId = new Map<string, unknown>();
  const attendeeResponseByFieldId = new Map<string, Map<string, unknown>>();

  for (const response of responses) {
    const field = fieldById.get(response.eventFormFieldId);
    if (!field) {
      continue;
    }

    if (getFieldScope(field) === FormFieldScope.ATTENDEE && response.attendeeId) {
      const byAttendee = attendeeResponseByFieldId.get(response.eventFormFieldId) ?? new Map<string, unknown>();
      byAttendee.set(response.attendeeId, response.value);
      attendeeResponseByFieldId.set(response.eventFormFieldId, byAttendee);
      continue;
    }

    if (!globalResponseByFieldId.has(response.eventFormFieldId)) {
      globalResponseByFieldId.set(response.eventFormFieldId, response.value);
    }
  }

  const globalResponsesByFieldKey = Object.fromEntries(
    dynamicFieldRules
      .filter((field) => getFieldScope(field) === FormFieldScope.GLOBAL)
      .map((field) => [field.key, globalResponseByFieldId.get(field.id)]),
  );

  const visibleFieldIds = new Set(
    dynamicFieldRules
      .filter((field) => isEventFieldVisible(field, globalResponsesByFieldKey))
      .map((field) => field.id),
  );

  const visibleDynamicFieldRules = dynamicFieldRules.filter((field) => visibleFieldIds.has(field.id));
  const filteredResponses = responses.filter((response) => visibleFieldIds.has(response.eventFormFieldId));

  if (input.nextStatus === RegistrationStatus.SUBMITTED) {
    if (eventModeConfig.allowsRosterAttendees && attendeeIds.length === 0) {
      throw new Error("Select at least one attendee before submitting registration.");
    }

    for (const field of visibleDynamicFieldRules) {
      if (getFieldScope(field) === FormFieldScope.ATTENDEE) {
        const responseValuesByAttendee = attendeeResponseByFieldId.get(field.id) ?? new Map<string, unknown>();

        for (const attendeeId of attendeeIds) {
          const responseValue = responseValuesByAttendee.get(attendeeId);

          if (field.isRequired && !hasResponseValue(responseValue)) {
            throw new Error(`Required attendee question is missing: "${field.label}".`);
          }

          validateResponseValue(field, responseValue, validAttendeeIds);
        }

        continue;
      }

      const responseValue = globalResponseByFieldId.get(field.id);

      if (field.isRequired && !hasResponseValue(responseValue)) {
        throw new Error(`Required question is missing: "${field.label}".`);
      }

      validateResponseValue(field, responseValue, validAttendeeIds);
    }
  }

  if (input.nextStatus === RegistrationStatus.SUBMITTED) {
    const attendeeLookup = new Map(rosterMembers.map((member) => [member.id, member]));
    const adultsMissingClearance = attendeeIds
      .map((attendeeId) => attendeeLookup.get(attendeeId))
      .filter((member): member is NonNullable<typeof member> => Boolean(member))
      .filter(
        (member) =>
          member.memberStatus !== MemberStatus.WALK_IN &&
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

  // Eligibility warnings (non-blocking — surface to director but do not prevent submission)
  const eligibilityWarnings: string[] = [];

  if (event.allowedClubTypes.length > 0 && !event.allowedClubTypes.includes(clubType)) {
    eligibilityWarnings.push(
      `Your club type (${clubType}) is not in the list of allowed club types for this event (${event.allowedClubTypes.join(", ")}).`,
    );
  }

  if (event.minAttendeeAge !== null || event.maxAttendeeAge !== null) {
    const attendeeLookupForAge = new Map(rosterMembers.map((m) => [m.id, m]));

    for (const attendeeId of attendeeIds) {
      const member = attendeeLookupForAge.get(attendeeId);
      if (!member) continue;

      const age = member.ageAtStart ?? (() => {
        if (!member.dateOfBirth) return null;
        const now2 = new Date();
        let calculated = now2.getFullYear() - member.dateOfBirth.getFullYear();
        const monthDiff = now2.getMonth() - member.dateOfBirth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && now2.getDate() < member.dateOfBirth.getDate())) {
          calculated -= 1;
        }
        return Math.max(calculated, 0);
      })();

      if (age === null) continue;

      if (event.minAttendeeAge !== null && age < event.minAttendeeAge) {
        eligibilityWarnings.push(
          `${member.firstName} ${member.lastName} (age ${age}) is below the minimum age of ${event.minAttendeeAge} for this event.`,
        );
      }

      if (event.maxAttendeeAge !== null && age > event.maxAttendeeAge) {
        eligibilityWarnings.push(
          `${member.firstName} ${member.lastName} (age ${age}) is above the maximum age of ${event.maxAttendeeAge} for this event.`,
        );
      }
    }
  }

  const now = input.now ?? new Date();
  const pricePerAttendee = now >= event.lateFeeStartsAt ? event.lateFeePrice : event.basePrice;
  const totalDue = attendeeIds.length * pricePerAttendee;
  let emailWarning: string | null = null;
  let savedRegistrationId: string | null = null;

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
      registrationOpensAt: event.registrationOpensAt,
      registrationClosesAt: event.registrationClosesAt,
      registrationStatus: existingRegistration?.status ?? null,
      now,
    });

    const registration = existingRegistration
      ? await tx.eventRegistration.update({
          where: {
            id: existingRegistration.id,
          },
          data: {
            status: input.nextStatus,
            submittedAt: input.nextStatus === RegistrationStatus.SUBMITTED ? new Date() : null,
            totalDue,
            paymentStatus: totalDue <= 0 ? PaymentStatus.PAID : PaymentStatus.PENDING,
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
            totalDue,
            paymentStatus: totalDue <= 0 ? PaymentStatus.PAID : PaymentStatus.PENDING,
          },
          select: {
            id: true,
          },
        });

    savedRegistrationId = registration.id;

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

    if (filteredResponses.length > 0) {
      await tx.eventFormResponse.createMany({
        data: filteredResponses.map((response) => ({
          eventRegistrationId: registration.id,
          eventFormFieldId: response.eventFormFieldId,
          attendeeId: response.attendeeId,
          value: response.value,
        })),
      });
    }
  });

  revalidatePath(`/director/events/${input.eventId}`);
  revalidatePath("/director/dashboard");
  revalidatePath("/director/events");

  if (input.nextStatus === RegistrationStatus.SUBMITTED) {
    const directorMembership = await prisma.clubMembership.findFirst({
      where: {
        clubId: input.clubId,
        user: { role: "CLUB_DIRECTOR" },
      },
      select: {
        user: { select: { email: true } },
      },
      orderBy: { isPrimary: "desc" },
    });

    const directorEmail = directorMembership?.user?.email ?? input.directorEmail;

    if (directorEmail) {
      const attendeeLookup = new Map(rosterMembers.map((m) => [m.id, m]));
      const attendeeList = attendeeIds
        .map((id) => attendeeLookup.get(id))
        .filter((m): m is NonNullable<typeof m> => Boolean(m))
        .map((m) => ({ name: `${m.firstName} ${m.lastName}`, role: m.memberRole }));

      let pdfAttachment: { filename: string; content: string } | null = null;

      if (savedRegistrationId) {
        try {
          const exportData = await getEventRegistrationExportDataById(savedRegistrationId);

          if (exportData) {
            const attendeeQrCodes = exportData.attendees.length > 0
              ? await generateAttendeeQrCodes(exportData.attendees)
              : undefined;

            const documentElement = createElement(EventRegistrationPdfDocument, {
              data: exportData,
              attendeeQrCodes,
            }) as ReactElement<DocumentProps>;

            const buffer = await renderToBuffer(documentElement);
            pdfAttachment = {
              filename: `${event.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-registration.pdf`,
              content: Buffer.from(buffer).toString("base64"),
            };
          }
        } catch (pdfError) {
          console.error("PDF generation for email attachment failed.", pdfError);
        }
      }

      try {
        await (input.sendConfirmationEmail ?? sendRegistrationConfirmationEmail)({
          to: directorEmail,
          eventName: event.name,
          eventStartsAt: event.startsAt,
          eventEndsAt: event.endsAt,
          locationName: event.locationName,
          locationAddress: event.locationAddress,
          attendees: attendeeList,
          totalDue,
          paymentStatus: totalDue <= 0 ? "PAID" : "PENDING",
          eventId: input.eventId,
          pdfAttachment,
        });
      } catch (error) {
        console.error("Registration was saved, but the confirmation email failed to send.", error);
        emailWarning = "Registration submitted, but the confirmation email could not be sent.";
      }
    }
  }

  return {
    emailWarning,
    registrationId: savedRegistrationId ?? "",
    totalDue,
    eventName: event.name,
    directorEmail: input.directorEmail,
    eligibilityWarnings,
  };
}

async function persistRegistration(formData: FormData, nextStatus: RegistrationStatus) {
  const eventIdEntry = formData.get("eventId");
  if (typeof eventIdEntry !== "string" || eventIdEntry.trim().length === 0) {
    throw new Error("Event id is required.");
  }

  const eventId = eventIdEntry.trim();
  const payload = parsePayload(formData.get("registrationPayload"));
  const context = await requireDirectorClubForEvent(eventId, readManagedClubIdFromFormData(formData));

  return persistRegistrationForClub({
    eventId,
    clubId: context.clubId,
    clubName: context.clubName,
    directorEmail: context.directorEmail,
    payload,
    nextStatus,
  });
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

    if (result.totalDue > 0 && result.registrationId && result.directorEmail) {
      try {
        const { checkoutUrl, squareOrderId } = await createCheckoutLink({
          registrationId: result.registrationId,
          amountInCents: Math.round(result.totalDue * 100),
          eventName: result.eventName,
          directorEmail: result.directorEmail,
        });

        await prisma.eventRegistration.update({
          where: { id: result.registrationId },
          data: { squareCheckoutUrl: checkoutUrl, squareOrderId },
        });

        return {
          status: "success",
          message: result.emailWarning ?? "Registration submitted. Redirecting to payment...",
          checkoutUrl,
          eligibilityWarnings: result.eligibilityWarnings,
        };
      } catch (squareError) {
        console.error("Square checkout link creation failed.", squareError);
        return {
          status: "success",
          message:
            result.emailWarning ??
            "Registration submitted. Visit your dashboard to complete payment.",
          eligibilityWarnings: result.eligibilityWarnings,
        };
      }
    }

    return {
      status: "success",
      message: result.emailWarning ?? "Registration submitted.",
      eligibilityWarnings: result.eligibilityWarnings,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to submit registration.",
    };
  }
}

export type WalkInAttendeeState = {
  status: "idle" | "success" | "error";
  message: string | null;
  attendee?: {
    id: string;
    firstName: string;
    lastName: string;
    memberRole: string;
    walkIn: true;
  };
};

export async function createWalkInAttendee(
  _prevState: WalkInAttendeeState,
  formData: FormData,
): Promise<WalkInAttendeeState> {
  try {
    const eventIdEntry = formData.get("eventId");
    if (typeof eventIdEntry !== "string" || eventIdEntry.trim().length === 0) {
      throw new Error("Event id is required.");
    }

    const clubIdOverride = formData.get("clubId");
    const managedClub = await getManagedClubContext(
      typeof clubIdOverride === "string" && clubIdOverride.trim().length > 0 ? clubIdOverride.trim() : null,
    );

    const firstNameEntry = formData.get("firstName");
    const lastNameEntry = formData.get("lastName");
    const memberRoleEntry = formData.get("memberRole");
    const ageEntry = formData.get("age");

    if (typeof firstNameEntry !== "string" || firstNameEntry.trim().length === 0) {
      throw new Error("First name is required.");
    }

    if (typeof lastNameEntry !== "string" || lastNameEntry.trim().length === 0) {
      throw new Error("Last name is required.");
    }

    if (typeof memberRoleEntry !== "string" || !(memberRoleEntry in MemberRole)) {
      throw new Error("Member role is required.");
    }

    const ageAtStart = typeof ageEntry === "string" && ageEntry.trim().length > 0
      ? Number(ageEntry.trim())
      : null;

    if (ageAtStart !== null && (Number.isNaN(ageAtStart) || ageAtStart < 0)) {
      throw new Error("Age must be a valid positive number.");
    }

    const activeRosterYear = await prisma.clubRosterYear.findFirst({
      where: {
        clubId: managedClub.clubId,
        isActive: true,
      },
      select: {
        id: true,
      },
      orderBy: {
        startsOn: "desc",
      },
    });

    if (!activeRosterYear) {
      throw new Error("No active roster year found for this club.");
    }

    const newMember = await prisma.rosterMember.create({
      data: {
        clubRosterYearId: activeRosterYear.id,
        firstName: firstNameEntry.trim(),
        lastName: lastNameEntry.trim(),
        memberRole: memberRoleEntry as MemberRole,
        memberStatus: MemberStatus.WALK_IN,
        ageAtStart,
        isActive: true,
        photoReleaseConsent: true,
        medicalTreatmentConsent: true,
        membershipAgreementConsent: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        memberRole: true,
      },
    });

    revalidatePath(`/director/events/${eventIdEntry.trim()}`);

    return {
      status: "success",
      message: null,
      attendee: {
        id: newMember.id,
        firstName: newMember.firstName,
        lastName: newMember.lastName,
        memberRole: newMember.memberRole,
        walkIn: true,
      },
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to create walk-in attendee.",
    };
  }
}
