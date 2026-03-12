import { FormFieldScope, FormFieldType, type Prisma } from "@prisma/client";

export type EventFieldScopeCarrier = {
  key: string;
  description?: string | null;
  options: Prisma.JsonValue | null;
  fieldScope: FormFieldScope;
  type?: FormFieldType | string;
};

export function getFieldScope(field: EventFieldScopeCarrier) {
  if (field.type === FormFieldType.FIELD_GROUP || field.type === "FIELD_GROUP") {
    return FormFieldScope.GLOBAL;
  }

  return field.fieldScope;
}

export function isAttendeeScopedField(field: EventFieldScopeCarrier) {
  return getFieldScope(field) === FormFieldScope.ATTENDEE;
}
