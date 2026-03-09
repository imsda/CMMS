import { isAttendeeSpecificField } from "./event-form-scope";
import type { DynamicFieldRule, PersistedResponse } from "./event-form-response-utils";

export function validateDynamicFieldResponses(args: {
  fields: DynamicFieldRule[];
  responses: PersistedResponse[];
  attendeeIds: string[];
  hasResponseValue: (value: unknown) => boolean;
  validateResponseValue: (field: DynamicFieldRule, value: unknown) => void;
}) {
  const responsesByField = new Map<string, PersistedResponse[]>();

  for (const response of args.responses) {
    const list = responsesByField.get(response.eventFormFieldId) ?? [];
    list.push(response);
    responsesByField.set(response.eventFormFieldId, list);
  }

  for (const field of args.fields) {
    const fieldResponses = responsesByField.get(field.id) ?? [];

    if (isAttendeeSpecificField(field)) {
      for (const attendeeId of args.attendeeIds) {
        const attendeeResponse = fieldResponses.find((response) => response.attendeeId === attendeeId);
        const value = attendeeResponse?.value;

        if (field.isRequired && !args.hasResponseValue(value)) {
          throw new Error(`Required attendee question is missing: "${field.label}" for attendee ${attendeeId}.`);
        }

        if (args.hasResponseValue(value)) {
          args.validateResponseValue(field, value);
        }
      }

      continue;
    }

    const globalResponse = fieldResponses.find((response) => response.attendeeId === null);
    const value = globalResponse?.value;

    if (field.isRequired && !args.hasResponseValue(value)) {
      throw new Error(`Required question is missing: "${field.label}".`);
    }

    if (args.hasResponseValue(value)) {
      args.validateResponseValue(field, value);
    }
  }
}
