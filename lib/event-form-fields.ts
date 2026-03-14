import { FormFieldType } from "@prisma/client";

export const FIELD_GROUP_CHILD_FIELD_TYPES = [
  FormFieldType.SHORT_TEXT,
  FormFieldType.LONG_TEXT,
  FormFieldType.DATE,
  FormFieldType.SINGLE_SELECT,
  FormFieldType.NUMBER,
  FormFieldType.MULTI_SELECT,
  FormFieldType.BOOLEAN,
  FormFieldType.ROSTER_SELECT,
  FormFieldType.ROSTER_MULTI_SELECT,
] as const;

export const EVENT_FORM_FIELD_TYPES = [
  ...FIELD_GROUP_CHILD_FIELD_TYPES,
  FormFieldType.FIELD_GROUP,
] as const;

export function getAllowedDynamicFieldTypes(parentFieldId: string | null) {
  return parentFieldId ? FIELD_GROUP_CHILD_FIELD_TYPES : EVENT_FORM_FIELD_TYPES;
}

export function typeAllowsOptions(type: FormFieldType | string) {
  return type === FormFieldType.SINGLE_SELECT || type === FormFieldType.MULTI_SELECT;
}
