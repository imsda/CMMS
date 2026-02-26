"use server";

import { FormFieldType, type Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "../../auth";
import { prisma } from "../../lib/prisma";

type IncomingDynamicField = {
  id?: string;
  parentFieldId?: string | null;
  key?: string;
  label?: string;
  description?: string;
  type?: string;
  isRequired?: boolean;
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

function parseMultiSelectOptions(raw: string, fieldKey: string) {
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
    const key = (candidate.key ?? "").trim();
    const label = (candidate.label ?? "").trim();
    const description = (candidate.description ?? "").trim();
    const type = candidate.type;
    const parentFieldId = typeof candidate.parentFieldId === "string" ? candidate.parentFieldId.trim() : null;

    if (id.length === 0) {
      throw new Error(`Dynamic field ${index + 1} is missing an id.`);
    }

    if (key.length === 0) {
      throw new Error(`Dynamic field ${index + 1} is missing a key.`);
    }

    if (label.length === 0) {
      throw new Error(`Dynamic field ${index + 1} is missing a label.`);
    }

    if (typeof type !== "string" || !supportedTypes.includes(type as FormFieldType)) {
      throw new Error(
        `Dynamic field ${index + 1} has an unsupported type. Use SHORT_TEXT, NUMBER, MULTI_SELECT, BOOLEAN, ROSTER_SELECT, ROSTER_MULTI_SELECT, or FIELD_GROUP.`,
      );
    }

    let options: Prisma.InputJsonValue | undefined;

    if (type === FormFieldType.MULTI_SELECT) {
      const optionsRaw = typeof candidate.optionsJson === "string" ? candidate.optionsJson : "";
      options = parseMultiSelectOptions(optionsRaw, key);
    }

    return {
      id,
      parentFieldId: parentFieldId && parentFieldId.length > 0 ? parentFieldId : null,
      key,
      label,
      description: description.length > 0 ? description : null,
      type: type as FormFieldType,
      options: options ?? null,
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

export async function createEventWithDynamicFields(formData: FormData) {
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

  if (endsAt <= startsAt) {
    throw new Error("Event end date must be after start date.");
  }

  if (registrationClosesAt <= registrationOpensAt) {
    throw new Error("Registration close date must be after registration open date.");
  }

  const locationName = optionalTrimmedString(formData.get("locationName"));
  const locationAddress = optionalTrimmedString(formData.get("locationAddress"));
  const dynamicFields = parseDynamicFields(formData.get("dynamicFieldsJson"));

  const uniqueKeys = new Set<string>();
  for (const field of dynamicFields) {
    if (uniqueKeys.has(field.key)) {
      throw new Error(`Dynamic field keys must be unique. Duplicate key: ${field.key}`);
    }
    uniqueKeys.add(field.key);
  }

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
        locationName,
        locationAddress,
        createdByUserId,
      },
      select: {
        id: true,
      },
    });

    if (dynamicFields.length > 0) {
      const idMap = new Map<string, string>();

      for (const field of dynamicFields.filter((entry) => entry.parentFieldId === null)) {
        const created = await tx.eventFormField.create({
          data: {
            eventId: event.id,
            key: field.key,
            label: field.label,
            description: field.description,
            type: field.type,
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
            eventId: event.id,
            parentFieldId: mappedParentId,
            key: field.key,
            label: field.label,
            description: field.description,
            type: field.type,
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
  });

  revalidatePath("/admin/events/new");
  redirect("/admin/events/new?created=1");
}
