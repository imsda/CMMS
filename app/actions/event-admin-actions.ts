"use server";

import {
  ClubType,
  EventMode,
  EventWorkflowType,
  EventTemplateCategory,
  EventTemplateSource,
  FormFieldScope,
  FormFieldType,
  RegistrationStatus,
  PaymentStatus,
  type Prisma,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  type CreateEventActionState,
  type EventTemplateActionState,
  type SendEventBroadcastActionState,
  type UpdateEventActionState,
} from "./event-admin-state";
import { getResendConfig } from "../../lib/email/resend";
import { auth } from "../../auth";
import {
  createEventFromInput,
  replaceEventDynamicFields,
  type EventMutationInput,
} from "../../lib/data/event-admin";
import {
  buildStoredEventFieldOptions,
  readEventFieldConfig,
  type EventFieldConditionalOperator,
} from "../../lib/event-form-config";
import { EVENT_FORM_FIELD_TYPES } from "../../lib/event-form-fields";
import { buildEventTemplateSnapshot } from "../../lib/event-templates";
import { parseEventMode, validateDynamicFieldsForEventMode } from "../../lib/event-modes";
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
  conditionalFieldKey?: string;
  conditionalOperator?: string;
  conditionalValue?: string;
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

function parseTemplateCategory(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return EventTemplateCategory.BASIC_EVENTS;
  }

  if (!Object.values(EventTemplateCategory).includes(value.trim() as EventTemplateCategory)) {
    throw new Error("Template category is invalid.");
  }

  return value.trim() as EventTemplateCategory;
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

async function resolveEventMode(formData: FormData) {
  const templateId = optionalTrimmedString(formData.get("templateId"));

  if (templateId) {
    const template = await prisma.eventTemplate.findUnique({
      where: {
        id: templateId,
      },
      select: {
        snapshot: true,
      },
    });

    if (!template) {
      throw new Error("Selected template was not found.");
    }

    const snapshot = template.snapshot as Record<string, unknown> | null;
    return parseEventMode(typeof snapshot?.eventMode === "string" ? snapshot.eventMode : null);
  }

  const rawMode = formData.get("eventMode");
  if (typeof rawMode !== "string" || rawMode.trim().length === 0) {
    throw new Error("Event mode is required when starting a blank event.");
  }

  if (!Object.values(EventMode).includes(rawMode.trim() as EventMode)) {
    throw new Error("Event mode is invalid.");
  }

  return rawMode.trim() as EventMode;
}

async function resolveWorkflowType(formData: FormData) {
  const templateId = optionalTrimmedString(formData.get("templateId"));

  if (!templateId) {
    return EventWorkflowType.STANDARD;
  }

  const template = await prisma.eventTemplate.findUnique({
    where: {
      id: templateId,
    },
    select: {
      snapshot: true,
    },
  });

  if (!template) {
    throw new Error("Selected template was not found.");
  }

  const snapshot = template.snapshot as Record<string, unknown> | null;
  return snapshot?.workflowType === EventWorkflowType.CAMPOREE
    ? EventWorkflowType.CAMPOREE
    : EventWorkflowType.STANDARD;
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

  const supportedTypes = [...EVENT_FORM_FIELD_TYPES];

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

    let optionValues: string[] = [];

    if (type === FormFieldType.SINGLE_SELECT || type === FormFieldType.MULTI_SELECT) {
      if (Array.isArray(candidate.options)) {
        optionValues = parseSelectOptionsArray(candidate.options, key);
      } else {
        const optionsRaw = typeof candidate.optionsJson === "string" ? candidate.optionsJson : "";
        optionValues = parseSelectOptions(optionsRaw, key);
      }
    }

    const conditionalFieldKey =
      typeof candidate.conditionalFieldKey === "string" ? candidate.conditionalFieldKey.trim() : "";
    const conditionalOperator =
      typeof candidate.conditionalOperator === "string" ? candidate.conditionalOperator.trim() : "";
    const conditionalValue =
      typeof candidate.conditionalValue === "string" ? candidate.conditionalValue : "";

    if (conditionalFieldKey.length > 0 && conditionalOperator.length === 0) {
      throw new Error(`Dynamic field "${key}" is missing a conditional operator.`);
    }

    if (
      conditionalOperator.length > 0 &&
      !["equals", "not_equals", "includes", "not_includes", "truthy", "falsy"].includes(conditionalOperator)
    ) {
      throw new Error(`Dynamic field "${key}" has an invalid conditional operator.`);
    }

    return {
      id,
      parentFieldId: parentFieldId && parentFieldId.length > 0 ? parentFieldId : null,
      key,
      label,
      description: description.length > 0 ? description : null,
      type: type as FormFieldType,
      options: buildStoredEventFieldOptions({
        optionValues,
        conditional:
          conditionalFieldKey.length > 0 && conditionalOperator.length > 0
            ? {
                fieldKey: conditionalFieldKey,
                operator: conditionalOperator as EventFieldConditionalOperator,
                value: conditionalValue,
              }
            : null,
      }),
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

  for (const field of normalized) {
    const conditional = readEventFieldConfig(field.options).conditional;

    if (!conditional) {
      continue;
    }

    if (conditional.fieldKey === field.key) {
      throw new Error(`Field "${field.key}" cannot depend on itself.`);
    }

    const dependency = normalized.find((candidate) => candidate.key === conditional.fieldKey);

    if (!dependency) {
      throw new Error(`Field "${field.key}" references an unknown conditional field key.`);
    }

    if (dependency.type === FormFieldType.FIELD_GROUP || dependency.fieldScope !== FormFieldScope.GLOBAL) {
      throw new Error(`Field "${field.key}" must depend on a global non-group field.`);
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

function parseOptionalPositiveInt(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function parseAllowedClubTypes(formData: FormData): string[] {
  const values = formData.getAll("allowedClubTypes");
  const validClubTypes = new Set<string>(Object.values(ClubType));

  return values
    .filter((v): v is string => typeof v === "string")
    .filter((v) => validClubTypes.has(v));
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

async function parseEventMutationInput(formData: FormData): Promise<EventMutationInput> {
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
  const dynamicFields = parseDynamicFields(formData.get("dynamicFieldsJson"));
  const eventMode = await resolveEventMode(formData);
  const workflowType = await resolveWorkflowType(formData);

  validateEventTimeline({
    startsAt,
    endsAt,
    registrationOpensAt,
    registrationClosesAt,
    lateFeeStartsAt,
  });

  prepareUniqueDynamicFieldKeys(dynamicFields);
  validateDynamicFieldsForEventMode(eventMode, dynamicFields);

  const minAttendeeAge = parseOptionalPositiveInt(formData.get("minAttendeeAge"));
  const maxAttendeeAge = parseOptionalPositiveInt(formData.get("maxAttendeeAge"));
  const allowedClubTypes = parseAllowedClubTypes(formData);

  return {
    eventMode,
    workflowType,
    name,
    description,
    startsAt,
    endsAt,
    registrationOpensAt,
    registrationClosesAt,
    basePrice,
    lateFeePrice,
    lateFeeStartsAt,
    locationName,
    locationAddress,
    minAttendeeAge,
    maxAttendeeAge,
    allowedClubTypes,
    dynamicFields,
  };
}

export async function createEventWithDynamicFields(
  _prevState: CreateEventActionState,
  formData: FormData,
): Promise<CreateEventActionState> {
  try {
    const createdByUserId = await requireSuperAdminUserId();
    const input = await parseEventMutationInput(formData);
    const slug = await buildUniqueSlug(input.name);

    await prisma.$transaction(async (tx) => {
      await createEventFromInput(tx, input, createdByUserId, slug);
    });

    revalidatePath("/admin/events/new");
    revalidatePath("/admin/events");
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

export async function saveEventTemplate(
  _prevState: EventTemplateActionState,
  formData: FormData,
): Promise<EventTemplateActionState> {
  try {
    const createdByUserId = await requireSuperAdminUserId();
    const templateId = optionalTrimmedString(formData.get("templateId"));
    const templateName = requireTrimmedString(formData.get("templateName"), "Template name");
    const templateDescription = optionalTrimmedString(formData.get("templateDescription"));
    const templateCategory = parseTemplateCategory(formData.get("templateCategory"));
    const isActive = formData.get("templateIsActive") === "on";
    const input = await parseEventMutationInput(formData);

    const snapshot = buildEventTemplateSnapshot({
      ...input,
      dynamicFields: input.dynamicFields,
    });

    if (templateId) {
      const existingTemplate = await prisma.eventTemplate.findUnique({
        where: {
          id: templateId,
        },
        select: {
          source: true,
        },
      });

      if (!existingTemplate) {
        throw new Error("Template not found.");
      }

      if (existingTemplate.source === EventTemplateSource.SYSTEM) {
        throw new Error("System templates cannot be edited directly. Duplicate the template first.");
      }

      await prisma.eventTemplate.update({
        where: {
          id: templateId,
        },
        data: {
          name: templateName,
          description: templateDescription,
          eventMode: input.eventMode,
          category: templateCategory,
          isActive,
          archivedAt: null,
          snapshot,
        },
      });
    } else {
      await prisma.eventTemplate.create({
        data: {
          name: templateName,
          description: templateDescription,
          eventMode: input.eventMode,
          category: templateCategory,
          source: EventTemplateSource.USER,
          isActive,
          snapshot,
          createdByUserId,
        },
      });
    }

    revalidatePath("/admin/events/new");
    revalidatePath("/admin/events/templates");
    return {
      status: "success",
      message: templateId ? "Event template updated." : "Event template saved.",
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to save event template.",
    };
  }
}

export async function toggleEventTemplateActive(formData: FormData) {
  await requireSuperAdminUserId();

  const templateId = requireTrimmedString(formData.get("templateId"), "Template");
  const nextActiveValue = requireTrimmedString(formData.get("nextActive"), "Template active state");

  await prisma.eventTemplate.update({
    where: {
      id: templateId,
    },
    data: {
      isActive: nextActiveValue === "true",
    },
  });

  revalidatePath("/admin/events/new");
  revalidatePath("/admin/events/templates");
}

export async function duplicateEventTemplate(formData: FormData) {
  const createdByUserId = await requireSuperAdminUserId();
  const templateId = requireTrimmedString(formData.get("templateId"), "Template");

  const template = await prisma.eventTemplate.findUnique({
    where: {
      id: templateId,
    },
  });

  if (!template) {
    throw new Error("Template not found.");
  }

  await prisma.eventTemplate.create({
    data: {
      name: `${template.name} Copy`,
      description: template.description,
      eventMode: template.eventMode,
      category: template.category,
      source: EventTemplateSource.USER,
      isActive: true,
      archivedAt: null,
      snapshot: template.snapshot,
      createdByUserId,
    },
  });

  revalidatePath("/admin/events/templates");
  revalidatePath("/admin/events/new");
}

export async function archiveEventTemplate(formData: FormData) {
  await requireSuperAdminUserId();
  const templateId = requireTrimmedString(formData.get("templateId"), "Template");

  const template = await prisma.eventTemplate.findUnique({
    where: {
      id: templateId,
    },
    select: {
      source: true,
    },
  });

  if (!template) {
    throw new Error("Template not found.");
  }

  if (template.source === EventTemplateSource.SYSTEM) {
    throw new Error("System templates cannot be archived.");
  }

  await prisma.eventTemplate.update({
    where: {
      id: templateId,
    },
    data: {
      isActive: false,
      archivedAt: new Date(),
    },
  });

  revalidatePath("/admin/events/templates");
  revalidatePath("/admin/events/new");
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
    const minAttendeeAge = parseOptionalPositiveInt(formData.get("minAttendeeAge"));
    const maxAttendeeAge = parseOptionalPositiveInt(formData.get("maxAttendeeAge"));
    const allowedClubTypes = parseAllowedClubTypes(formData);
    const isPublished = formData.get("isPublished") === "true";

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
        minAttendeeAge,
        maxAttendeeAge,
        allowedClubTypes,
        isPublished,
      },
    });

    revalidatePath("/events");

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
        eventMode: true,
        name: true,
        description: true,
        startsAt: true,
        endsAt: true,
        registrationOpensAt: true,
        registrationClosesAt: true,
        basePrice: true,
        lateFeePrice: true,
        lateFeeStartsAt: true,
        locationName: true,
        locationAddress: true,
        createdByUserId: true,
        slug: true,
      },
    });

    if (!existingEvent) {
      throw new Error("Event not found.");
    }

    validateDynamicFieldsForEventMode(existingEvent.eventMode, dynamicFields);

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

// --- Event Broadcast ---

type BroadcastFilter = "ALL" | "APPROVED_ONLY" | "PENDING_PAYMENT_ONLY";

function parseBroadcastFilter(value: FormDataEntryValue | null): BroadcastFilter {
  if (value === "APPROVED_ONLY") return "APPROVED_ONLY";
  if (value === "PENDING_PAYMENT_ONLY") return "PENDING_PAYMENT_ONLY";
  return "ALL";
}

export async function getEventBroadcastRecipientCount(
  eventId: string,
  filter: BroadcastFilter,
): Promise<number> {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return 0;
  }

  const where = buildBroadcastWhere(eventId, filter);
  const count = await prisma.eventRegistration.count({ where });
  return count;
}

const ACTIVE_REGISTRATION_STATUSES: RegistrationStatus[] = [
  RegistrationStatus.SUBMITTED,
  RegistrationStatus.REVIEWED,
  RegistrationStatus.NEEDS_CHANGES,
  RegistrationStatus.APPROVED,
];

function buildBroadcastWhere(
  eventId: string,
  filter: BroadcastFilter,
): Prisma.EventRegistrationWhereInput {
  if (filter === "APPROVED_ONLY") {
    return {
      eventId,
      status: RegistrationStatus.APPROVED,
    };
  }

  if (filter === "PENDING_PAYMENT_ONLY") {
    return {
      eventId,
      status: { in: ACTIVE_REGISTRATION_STATUSES },
      paymentStatus: PaymentStatus.PENDING,
    };
  }

  return {
    eventId,
    status: { in: ACTIVE_REGISTRATION_STATUSES },
  };
}

export async function sendEventBroadcast(
  _prevState: SendEventBroadcastActionState,
  formData: FormData,
): Promise<SendEventBroadcastActionState> {
  try {
    await requireSuperAdminUserId();

    const eventId = requireTrimmedString(formData.get("eventId"), "Event");
    const subject = requireTrimmedString(formData.get("subject"), "Subject");
    const body = requireTrimmedString(formData.get("body"), "Message body");
    const filter = parseBroadcastFilter(formData.get("filter"));

    // Verify event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, name: true },
    });

    if (!event) {
      return { status: "error", message: "Event not found.", sentCount: null };
    }

    // Fetch registrations matching the filter with primary director email
    const registrations = await prisma.eventRegistration.findMany({
      where: buildBroadcastWhere(eventId, filter),
      select: {
        id: true,
        club: {
          select: {
            name: true,
            memberships: {
              where: { isPrimary: true },
              select: {
                user: { select: { email: true, name: true } },
              },
              take: 1,
            },
          },
        },
      },
    });

    const resendConfig = getResendConfig();
    let sentCount = 0;
    const failures: string[] = [];

    const htmlBody = body
      .split("\n")
      .map((line) => `<p>${line}</p>`)
      .join("");

    for (const reg of registrations) {
      const primaryMembership = reg.club.memberships[0];
      if (!primaryMembership) {
        failures.push(`${reg.club.name}: no primary director email`);
        continue;
      }

      const recipientEmail = primaryMembership.user.email;

      if (!resendConfig) {
        console.warn(
          `Skipping broadcast email to ${recipientEmail}: RESEND not configured.`,
        );
        failures.push(`${reg.club.name}: email service not configured`);
        continue;
      }

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendConfig.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: resendConfig.from,
          to: [recipientEmail],
          subject,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1e293b;">${subject}</h2>
              <p style="color: #475569; font-size: 14px;">
                Message regarding: <strong>${event.name}</strong>
              </p>
              <hr style="border-color: #e2e8f0; margin: 16px 0;" />
              <div style="color: #334155; line-height: 1.6;">
                ${htmlBody}
              </div>
              <hr style="border-color: #e2e8f0; margin: 16px 0;" />
              <p style="color: #94a3b8; font-size: 12px;">
                This message was sent to ${primaryMembership.user.name ?? recipientEmail}
                as the primary director for ${reg.club.name}.
              </p>
            </div>
          `,
        }),
      });

      if (response.ok) {
        sentCount += 1;
      } else {
        const payload = await response.text();
        failures.push(
          `${reg.club.name}: ${response.status} ${payload}`.slice(0, 200),
        );
      }
    }

    // Store broadcast record
    await prisma.eventBroadcast.create({
      data: {
        eventId,
        subject,
        recipientCount: sentCount,
      },
    });

    revalidatePath(`/admin/events/${eventId}`);

    const failureSummary =
      failures.length > 0
        ? ` (${failures.length} failed: ${failures.slice(0, 3).join("; ")})`
        : "";

    return {
      status: "success",
      message: `Sent to ${sentCount} director(s).${failureSummary}`,
      sentCount,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to send broadcast.",
      sentCount: null,
    };
  }
}
