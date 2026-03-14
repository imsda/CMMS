import {
  EventMode,
  EventWorkflowType,
  EventTemplateCategory,
  EventTemplateSource,
  FormFieldScope,
  FormFieldType,
  type Prisma,
} from "@prisma/client";

import {
  readEventFieldConfig,
  type EventFieldConditionalOperator,
} from "./event-form-config";
import { parseEventMode } from "./event-modes";

export type EventTemplateDynamicField = {
  id: string;
  parentFieldId: string | null;
  key: string;
  label: string;
  description: string;
  type: FormFieldType;
  fieldScope: FormFieldScope;
  isRequired: boolean;
  options: string[];
  conditionalFieldKey: string;
  conditionalOperator: EventFieldConditionalOperator | null;
  conditionalValue: string;
};

export type EventTemplateSnapshot = {
  eventMode: EventMode;
  workflowType?: EventWorkflowType;
  name: string;
  description: string;
  startsAt: string;
  endsAt: string;
  registrationOpensAt: string;
  registrationClosesAt: string;
  basePrice: number;
  lateFeePrice: number;
  lateFeeStartsAt: string;
  locationName: string;
  locationAddress: string;
  dynamicFields: EventTemplateDynamicField[];
};

export type EventTemplateDraft = {
  id: string;
  templateKey: string | null;
  name: string;
  description: string;
  eventMode: EventMode;
  category: EventTemplateCategory;
  source: EventTemplateSource;
  isActive: boolean;
  archivedAt: string | null;
  updatedAt: string;
  snapshot: EventTemplateSnapshot;
};

type RawDynamicField = {
  id: string;
  parentFieldId: string | null;
  key: string;
  label: string;
  description: string | null;
  type: FormFieldType;
  fieldScope: FormFieldScope;
  isRequired: boolean;
  options: unknown;
};

function readString(value: unknown, label: string) {
  if (typeof value !== "string") {
    throw new Error(`${label} is invalid.`);
  }

  return value;
}

function readNumber(value: unknown, label: string) {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    throw new Error(`${label} is invalid.`);
  }

  return value;
}

function readStringArray(value: unknown, label: string) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} is invalid.`);
  }

  return value.map((entry) => {
    if (typeof entry !== "string") {
      throw new Error(`${label} is invalid.`);
    }

    return entry;
  });
}

function readNullableConditionalOperator(value: unknown, label: string): EventFieldConditionalOperator | null {
  if (value === null || typeof value === "undefined" || value === "") {
    return null;
  }

  if (
    value === "equals" ||
    value === "not_equals" ||
    value === "includes" ||
    value === "not_includes" ||
    value === "truthy" ||
    value === "falsy"
  ) {
    return value;
  }

  throw new Error(`${label} is invalid.`);
}

export function toTemplateDatetimeValue(date: Date) {
  return date.toISOString().slice(0, 16);
}

export function readTemplateFieldOptions(options: unknown) {
  if (!Array.isArray(options)) {
    return [];
  }

  return options.filter((option): option is string => typeof option === "string");
}

export function buildEventTemplateSnapshot(input: {
  eventMode: EventMode;
  workflowType?: EventWorkflowType;
  name: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date;
  registrationOpensAt: Date;
  registrationClosesAt: Date;
  basePrice: number;
  lateFeePrice: number;
  lateFeeStartsAt: Date;
  locationName: string | null;
  locationAddress: string | null;
  dynamicFields: RawDynamicField[];
}): EventTemplateSnapshot {
  return {
    eventMode: input.eventMode,
    workflowType: input.workflowType ?? EventWorkflowType.STANDARD,
    name: input.name,
    description: input.description ?? "",
    startsAt: toTemplateDatetimeValue(input.startsAt),
    endsAt: toTemplateDatetimeValue(input.endsAt),
    registrationOpensAt: toTemplateDatetimeValue(input.registrationOpensAt),
    registrationClosesAt: toTemplateDatetimeValue(input.registrationClosesAt),
    basePrice: input.basePrice,
    lateFeePrice: input.lateFeePrice,
    lateFeeStartsAt: toTemplateDatetimeValue(input.lateFeeStartsAt),
    locationName: input.locationName ?? "",
    locationAddress: input.locationAddress ?? "",
    dynamicFields: input.dynamicFields.map((field) => {
      const config = readEventFieldConfig(field.options);

      return {
        id: field.id,
        parentFieldId: field.parentFieldId,
        key: field.key,
        label: field.label,
        description: field.description ?? "",
        type: field.type,
        fieldScope: field.fieldScope,
        isRequired: field.isRequired,
        options: config.optionValues,
        conditionalFieldKey: config.conditional?.fieldKey ?? "",
        conditionalOperator: config.conditional?.operator ?? null,
        conditionalValue: config.conditional?.value ?? "",
      };
    }),
  };
}

export function parseEventTemplateSnapshot(snapshot: Prisma.JsonValue): EventTemplateSnapshot {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    throw new Error("Template snapshot is invalid.");
  }

  const candidate = snapshot as Record<string, unknown>;
  const rawDynamicFields = candidate.dynamicFields;

  if (!Array.isArray(rawDynamicFields)) {
    throw new Error("Template dynamic fields are invalid.");
  }

  return {
    eventMode: parseEventMode(typeof candidate.eventMode === "string" ? candidate.eventMode : null),
    workflowType:
      candidate.workflowType === EventWorkflowType.CAMPOREE
        ? EventWorkflowType.CAMPOREE
        : EventWorkflowType.STANDARD,
    name: readString(candidate.name, "Template name"),
    description: readString(candidate.description ?? "", "Template description"),
    startsAt: readString(candidate.startsAt, "Template start date"),
    endsAt: readString(candidate.endsAt, "Template end date"),
    registrationOpensAt: readString(candidate.registrationOpensAt, "Template registration open date"),
    registrationClosesAt: readString(candidate.registrationClosesAt, "Template registration close date"),
    basePrice: readNumber(candidate.basePrice, "Template base price"),
    lateFeePrice: readNumber(candidate.lateFeePrice, "Template late fee price"),
    lateFeeStartsAt: readString(candidate.lateFeeStartsAt, "Template late fee start date"),
    locationName: readString(candidate.locationName ?? "", "Template location name"),
    locationAddress: readString(candidate.locationAddress ?? "", "Template location address"),
    dynamicFields: rawDynamicFields.map((field, index) => {
      if (!field || typeof field !== "object" || Array.isArray(field)) {
        throw new Error(`Template field ${index + 1} is invalid.`);
      }

      const candidateField = field as Record<string, unknown>;
      const type = readString(candidateField.type, `Template field ${index + 1} type`);
      const fieldScope = readString(candidateField.fieldScope, `Template field ${index + 1} scope`);

      if (!Object.values(FormFieldType).includes(type as FormFieldType)) {
        throw new Error(`Template field ${index + 1} type is invalid.`);
      }

      if (!Object.values(FormFieldScope).includes(fieldScope as FormFieldScope)) {
        throw new Error(`Template field ${index + 1} scope is invalid.`);
      }

      return {
        id: readString(candidateField.id, `Template field ${index + 1} id`),
        parentFieldId:
          candidateField.parentFieldId === null
            ? null
            : readString(candidateField.parentFieldId, `Template field ${index + 1} parent`),
        key: readString(candidateField.key, `Template field ${index + 1} key`),
        label: readString(candidateField.label, `Template field ${index + 1} label`),
        description: readString(candidateField.description ?? "", `Template field ${index + 1} description`),
        type: type as FormFieldType,
        fieldScope: fieldScope as FormFieldScope,
        isRequired: Boolean(candidateField.isRequired),
        options: readStringArray(candidateField.options ?? [], `Template field ${index + 1} options`),
        conditionalFieldKey: readString(
          candidateField.conditionalFieldKey ?? "",
          `Template field ${index + 1} conditional key`,
        ),
        conditionalOperator: readNullableConditionalOperator(
          candidateField.conditionalOperator ?? null,
          `Template field ${index + 1} conditional operator`,
        ),
        conditionalValue: readString(
          candidateField.conditionalValue ?? "",
          `Template field ${index + 1} conditional value`,
        ),
      };
    }),
  };
}

export function serializeEventTemplateDraft(template: {
  id: string;
  templateKey: string | null;
  name: string;
  description: string | null;
  eventMode: EventMode;
  category: EventTemplateCategory;
  source: EventTemplateSource;
  isActive: boolean;
  archivedAt: Date | null;
  updatedAt: Date;
  snapshot: Prisma.JsonValue;
}): EventTemplateDraft {
  return {
    id: template.id,
    templateKey: template.templateKey,
    name: template.name,
    description: template.description ?? "",
    eventMode: template.eventMode,
    category: template.category,
    source: template.source,
    isActive: template.isActive,
    archivedAt: template.archivedAt ? template.archivedAt.toISOString() : null,
    updatedAt: template.updatedAt.toISOString(),
    snapshot: parseEventTemplateSnapshot(template.snapshot),
  };
}
