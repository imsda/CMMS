"use server";

import { FormFieldScope, FormFieldType, type Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  type CreateEventActionState,
  type UpdateEventActionState,
} from "./event-admin-state";
import { auth } from "../../auth";
import { prisma } from "../../lib/prisma";

type IncomingDynamicField = {
  id?: string;
  parentFieldId?: string | null;
  key?: string;
  label?: string;
  description?: string;
  type?: string;
  fieldScope?: string;
  isRequired?: boolean;
  options?: string[];
  optionsJson?: string;
};

function requireTrimmedString(value: FormDataEntryValue | null, fieldLabel: string) {
  if (typeof value !== "string") {
    throw new Error(`${fieldLabel} is required.`);
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${fieldLabel} is required.`);
  }

  return trimmed;
}

function optionalTrimmedString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function parseRequiredDate(value: FormDataEntryValue | null, fieldLabel: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldLabel} is required.`);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldLabel} is invalid.`);
  }

  return parsed;
}

function parseRequiredFloat(value: FormDataEntryValue | null, fieldLabel: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldLabel} is required.`);
  }

  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error(`${fieldLabel} must be a valid non-negative number.`);
  }

  return parsed;
}

function parseSelectOptions(raw: string, fieldKey: string) {
  try {
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      throw new Error();
    }

    const normalized = parsed.map((option) => {
      if (typeof option !== "string" || option.trim().length === 0) {
        throw new Error();
      }
      return option.trim();
    });

    if (normalized.length === 0) {
      throw new Error();
    }

    return normalized;
  } catch {
    throw new Error(
      `Dynamic field "${fieldKey}" requires optionsJson to be a JSON array of non-empty strings.`,
    );
  }
}

function parseSelectOptionsArray(options: unknown, fieldKey: string) {
  if (!Array.isArray(options)) {
    throw new Error(`Dynamic field "${fieldKey}" must include at least one option.`);
  }

  const normalized = options.map((option) => {
    if (typeof option !== "string" || option.trim().length === 0) {
      throw new Error(`Dynamic field "${fieldKey}" has an invalid option.`);
    }

    return option.trim();
  });

  if (normalized.length === 0) {
    throw new Error(`Dynamic field "${fieldKey}" must include at least one option.`);
  }

  const uniqueNormalized = Array.from(new Set(normalized.map((option) => option.toLowerCase())));
  if (uniqueNormalized.length !== normalized.length) {
    throw new Error(`Dynamic field "${fieldKey}" options must be unique.`);
  }

  return normalized;
}

function normalizeDynamicFieldKey(rawKey: string, fallbackLabel: string, index: number) {
  const source = rawKey.length > 0 ? rawKey : fallbackLabel;

  const normalized = source
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);

  if (normalized.length > 0) {
    return normalized;
  }

  return `field_${index + 1}`;
}

function slugifyName(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

async function requireSuperAdminUserId() {
  const session = await auth();

  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    throw new Error("Only super admins can create events.");
  }

  return session.user.id;
}

function validateEventTimeline(input: {
  startsAt: Date;
  endsAt: Date;
  registrationOpensAt: Date;
  registrationClosesAt: Date;
  lateFeeStartsAt: Date;
}) {
  if (input.endsAt <= input.startsAt) {
    throw new Error("Event end date must be after start date.");
  }

  if (input.registrationClosesAt <= input.registrationOpensAt) {
    throw new Error("Registration close date must be after registration open date.");
  }

  if (input.lateFeeStartsAt < input.registrationOpensAt) {
    throw new Error("Late fee start date cannot be before registration opens.");
  }
}

function parseDynamicFields(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return [];
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Dynamic fields payload is not valid JSON.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Dynamic fields payload must be an array.");
  }

  const supportedTypes: FormFieldType[] = [
    FormFieldType.SHORT_TEXT,
    FormFieldType.LONG_TEXT,
    FormFieldType.DATE,
    FormFieldType.SINGLE_SELECT,
    FormFieldType.MULTI_SELECT,
    FormFieldType.BOOLEAN,
    FormFieldType.NUMBER,
    FormFieldType.ROSTER_SELECT,
    FormFieldType.ROSTER_MULTI_SELECT,
    FormFieldType.FIELD_GROUP,
  ];

  const normalized = parsed.map((field, index) => {
    const candidate = field as IncomingDynamicField;
    const id = (candidate.id ?? "").trim();
    const label = (candidate.label ?? "").trim();
    const key = normalizeDynamicFieldKey((candidate.key ?? "").trim(), label, index);
    const description = (candidate.description ?? "").trim();
    const type = candidate.type;
    const parentFieldId = typeof candidate.parentFieldId === "string" ? candidate.parentFieldId.trim() : null;
    const fieldScope =
      candidate.fieldScope === FormFieldScope.ATTENDEE ? FormFieldScope.ATTENDEE : FormFieldScope.GLOBAL;

    if (id.length === 0) {
      throw new Error(`Dynamic field ${index + 1} is missing an id.`);
    }

    if (label.length === 0) {
      throw new Error(`Dynamic field ${index + 1} is missing a label.`);
    }

    if (typeof type !== "string" || !supportedTypes.includes(type as FormFieldType)) {
      throw new Error(
        `Dynamic field ${index + 1} has an unsupported type. Use SHORT_TEXT, LONG_TEXT, DATE, SINGLE_SELECT, MULTI_SELECT, NUMBER, BOOLEAN, ROSTER_SELECT, ROSTER_MULTI_SELECT, or FIELD_GROUP.`,
      );
    }

    let options: Prisma.InputJsonValue | undefined;

    if (type === FormFieldType.SINGLE_SELECT || type === FormFieldType.MULTI_SELECT) {
      if (Array.isArray(candidate.options)) {
        options = parseSelectOptionsArray(candidate.options, key);
      } else {
        const optionsRaw = typeof candidate.optionsJson === "string" ? candidate.optionsJson : "";
        options = parseSelectOptions(optionsRaw, key);
      }
    }

    return {
      id,
      parentFieldId: parentFieldId && parentFieldId.length > 0 ? parentFieldId : null,
      key,
      label,
      description: description.length > 0 ? description : null,
      type: type as FormFieldType,
      options: options ?? null,
      fieldScope: type === FormFieldType.FIELD_GROUP ? FormFieldScope.GLOBAL : fieldScope,
      isRequired: type === FormFieldType.FIELD_GROUP ? false : Boolean(candidate.isRequired),
      sortOrder: index,
    };
  });

  const byId = new Map(normalized.map((field) => [field.id, field]));

  for (const field of normalized) {
    if (!field.parentFieldId) {
      continue;
    }

    const parent = byId.get(field.parentFieldId);
    if (!parent) {
      throw new Error(`Field "${field.key}" references an unknown parent field.`);
    }

    if (parent.type !== FormFieldType.FIELD_GROUP) {
      throw new Error(`Field "${field.key}" must reference a FIELD_GROUP parent.`);
    }

    if (field.type === FormFieldType.FIELD_GROUP) {
      throw new Error("Nested FIELD_GROUP values are not supported.");
    }
  }

  return normalized;
}

function prepareUniqueDynamicFieldKeys(
  dynamicFields: ReturnType<typeof parseDynamicFields>,
) {
  const uniqueKeys = new Set<string>();

  for (const field of dynamicFields) {
    let candidateKey = field.key;
    let counter = 2;

    while (uniqueKeys.has(candidateKey)) {
      candidateKey = `${field.key}_${counter}`;
      counter += 1;
    }

    field.key = candidateKey;
    uniqueKeys.add(candidateKey);
  }
}

async function replaceEventDynamicFields(
  tx: Prisma.TransactionClient,
  eventId: string,
  dynamicFields: ReturnType<typeof parseDynamicFields>,
) {
  await tx.eventFormField.deleteMany({
    where: {
      eventId,
    },
  });

  if (dynamicFields.length === 0) {
    return;
  }

  const idMap = new Map<string, string>();

  for (const field of dynamicFields.filter((entry) => entry.parentFieldId === null)) {
    const created = await tx.eventFormField.create({
      data: {
        eventId,
        key: field.key,
        label: field.label,
        description: field.description,
        type: field.type,
        fieldScope: field.fieldScope,
        options: field.options,
        isRequired: field.isRequired,
        sortOrder: field.sortOrder,
      },
      select: {
        id: true,
      },
    });

    idMap.set(field.id, created.id);
  }

  for (const field of dynamicFields.filter((entry) => entry.parentFieldId !== null)) {
    const mappedParentId = idMap.get(field.parentFieldId as string);

    if (!mappedParentId) {
      throw new Error(`Could not resolve parent for field: ${field.key}`);
    }

    const created = await tx.eventFormField.create({
      data: {
        eventId,
        parentFieldId: mappedParentId,
        key: field.key,
        label: field.label,
        description: field.description,
        type: field.type,
        fieldScope: field.fieldScope,
        options: field.options,
        isRequired: field.isRequired,
        sortOrder: field.sortOrder,
      },
      select: {
        id: true,
      },
    });

    idMap.set(field.id, created.id);
  }
}

async function buildUniqueSlug(name: string) {
  const base = slugifyName(name);

  if (base.length === 0) {
    return `event-${Date.now()}`;
  }

  const existing = await prisma.event.findUnique({
    where: {
      slug: base,
    },
    select: {
      id: true,
    },
  });

  if (!existing) {
    return base;
  }

  return `${base}-${Date.now()}`;
}

function isRedirectError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

export async function createEventWithDynamicFields(
  _prevState: CreateEventActionState,
  formData: FormData,
): Promise<CreateEventActionState> {
  try {
    const createdByUserId = await requireSuperAdminUserId();

    const name = requireTrimmedString(formData.get("name"), "Event name");
    const startsAt = parseRequiredDate(formData.get("startsAt"), "Event start date");
    const endsAt = parseRequiredDate(formData.get("endsAt"), "Event end date");
    const registrationOpensAt = parseRequiredDate(
      formData.get("registrationOpensAt"),
      "Registration open date",
    );
    const registrationClosesAt = parseRequiredDate(
      formData.get("registrationClosesAt"),
      "Registration close date",
    );
    const basePrice = parseRequiredFloat(formData.get("basePrice"), "Base price");
    const lateFeePrice = parseRequiredFloat(formData.get("lateFeePrice"), "Late fee price");
    const lateFeeStartsAt = parseRequiredDate(formData.get("lateFeeStartsAt"), "Late fee start date");

    validateEventTimeline({
      startsAt,
      endsAt,
      registrationOpensAt,
      registrationClosesAt,
      lateFeeStartsAt,
    });

    const locationName = optionalTrimmedString(formData.get("locationName"));
    const locationAddress = optionalTrimmedString(formData.get("locationAddress"));
    const dynamicFields = parseDynamicFields(formData.get("dynamicFieldsJson"));

    prepareUniqueDynamicFieldKeys(dynamicFields);

    const slug = await buildUniqueSlug(name);

    await prisma.$transaction(async (tx) => {
      const event = await tx.event.create({
        data: {
          name,
          slug,
          startsAt,
          endsAt,
          registrationOpensAt,
          registrationClosesAt,
          basePrice,
          lateFeePrice,
          lateFeeStartsAt,
          locationName,
          locationAddress,
          createdByUserId,
        },
        select: {
          id: true,
        },
      });

      await replaceEventDynamicFields(tx, event.id, dynamicFields);
    });

    revalidatePath("/admin/events/new");
    redirect("/admin/events/new?created=1");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to create event.",
    };
  }
}

export async function updateEventCoreDetails(
  _prevState: UpdateEventActionState,
  formData: FormData,
): Promise<UpdateEventActionState> {
  try {
    await requireSuperAdminUserId();

    const eventId = requireTrimmedString(formData.get("eventId"), "Event");
    const name = requireTrimmedString(formData.get("name"), "Event name");
    const startsAt = parseRequiredDate(formData.get("startsAt"), "Event start date");
    const endsAt = parseRequiredDate(formData.get("endsAt"), "Event end date");
    const registrationOpensAt = parseRequiredDate(
      formData.get("registrationOpensAt"),
      "Registration open date",
    );
    const registrationClosesAt = parseRequiredDate(
      formData.get("registrationClosesAt"),
      "Registration close date",
    );
    const basePrice = parseRequiredFloat(formData.get("basePrice"), "Base price");
    const lateFeePrice = parseRequiredFloat(formData.get("lateFeePrice"), "Late fee price");
    const lateFeeStartsAt = parseRequiredDate(formData.get("lateFeeStartsAt"), "Late fee start date");
    const locationName = optionalTrimmedString(formData.get("locationName"));
    const locationAddress = optionalTrimmedString(formData.get("locationAddress"));
    const description = optionalTrimmedString(formData.get("description"));

    validateEventTimeline({
      startsAt,
      endsAt,
      registrationOpensAt,
      registrationClosesAt,
      lateFeeStartsAt,
    });

    await prisma.event.update({
      where: {
        id: eventId,
      },
      data: {
        name,
        startsAt,
        endsAt,
        registrationOpensAt,
        registrationClosesAt,
        basePrice,
        lateFeePrice,
        lateFeeStartsAt,
        locationName,
        locationAddress,
        description,
      },
    });

    revalidatePath("/admin/events");
    revalidatePath(`/admin/events/${eventId}`);
    revalidatePath(`/admin/events/${eventId}/edit`);

    return {
      status: "success",
      message: "Event details updated.",
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to update event.",
    };
  }
}

export async function updateEventDynamicFields(
  _prevState: UpdateEventActionState,
  formData: FormData,
): Promise<UpdateEventActionState> {
  try {
    await requireSuperAdminUserId();

    const eventId = requireTrimmedString(formData.get("eventId"), "Event");
    const dynamicFields = parseDynamicFields(formData.get("dynamicFieldsJson"));
    prepareUniqueDynamicFieldKeys(dynamicFields);

    const existingEvent = await prisma.event.findUnique({
      where: {
        id: eventId,
      },
      select: {
        id: true,
      },
    });

    if (!existingEvent) {
      throw new Error("Event not found.");
    }

    const responseCount = await prisma.eventFormResponse.count({
      where: {
        field: {
          eventId,
        },
      },
    });

    if (responseCount > 0) {
      throw new Error(
        "Dynamic questions cannot be edited after clubs have submitted responses for this event.",
      );
    }

    await prisma.$transaction(async (tx) => {
      await replaceEventDynamicFields(tx, eventId, dynamicFields);
    });

    revalidatePath(`/admin/events/${eventId}`);
    revalidatePath(`/admin/events/${eventId}/edit`);
    revalidatePath("/director/events");

    return {
      status: "success",
      message: "Dynamic registration questions updated.",
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to update dynamic questions.",
    };
  }
}
