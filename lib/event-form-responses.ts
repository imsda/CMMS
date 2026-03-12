import { FormFieldScope, type Prisma } from "@prisma/client";

import { getFieldScope, type EventFieldScopeCarrier } from "./event-form-scope";

export type PersistedEventResponse = {
  fieldId: string;
  attendeeId: string | null;
  value: Prisma.InputJsonValue;
};

export type EventFieldRule = EventFieldScopeCarrier & {
  id: string;
  label: string;
  isRequired: boolean;
};

export type RegistrationResponseState = {
  globalResponses: Record<string, unknown>;
  attendeeResponses: Record<string, Record<string, unknown>>;
};

export function bootstrapRegistrationResponses(
  responses: Array<{ fieldId: string; attendeeId: string | null; value: unknown }>,
): RegistrationResponseState {
  const state: RegistrationResponseState = {
    globalResponses: {},
    attendeeResponses: {},
  };

  for (const response of responses) {
    if (response.attendeeId) {
      state.attendeeResponses[response.attendeeId] = {
        ...(state.attendeeResponses[response.attendeeId] ?? {}),
        [response.fieldId]: response.value,
      };
      continue;
    }

    state.globalResponses[response.fieldId] = response.value;
  }

  return state;
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

export function serializeRegistrationResponses(input: {
  fields: EventFieldRule[];
  selectedAttendeeIds: string[];
  globalResponses: Record<string, unknown>;
  attendeeResponses: Record<string, Record<string, unknown>>;
}) {
  const selectedAttendeeIds = Array.from(new Set(input.selectedAttendeeIds));
  const selectedAttendeeSet = new Set(selectedAttendeeIds);
  const responses: PersistedEventResponse[] = [];

  for (const field of input.fields) {
    if (getFieldScope(field) === FormFieldScope.ATTENDEE) {
      for (const attendeeId of selectedAttendeeIds) {
        if (!selectedAttendeeSet.has(attendeeId)) {
          continue;
        }

        const value = input.attendeeResponses[attendeeId]?.[field.id];
        if (!hasResponseValue(value)) {
          continue;
        }

        responses.push({
          fieldId: field.id,
          attendeeId,
          value: value as Prisma.InputJsonValue,
        });
      }

      continue;
    }

    const value = input.globalResponses[field.id];
    if (!hasResponseValue(value)) {
      continue;
    }

    responses.push({
      fieldId: field.id,
      attendeeId: null,
      value: value as Prisma.InputJsonValue,
    });
  }

  return {
    attendeeIds: selectedAttendeeIds,
    responses,
  };
}

export function validateRequiredRegistrationResponses(input: {
  fields: EventFieldRule[];
  selectedAttendeeIds: string[];
  globalResponses: Record<string, unknown>;
  attendeeResponses: Record<string, Record<string, unknown>>;
}) {
  if (input.selectedAttendeeIds.length === 0) {
    return "Select at least one attendee before submitting registration.";
  }

  for (const field of input.fields) {
    if (!field.isRequired) {
      continue;
    }

    if (getFieldScope(field) === FormFieldScope.ATTENDEE) {
      for (const attendeeId of input.selectedAttendeeIds) {
        const value = input.attendeeResponses[attendeeId]?.[field.id];
        if (!hasResponseValue(value)) {
          return `Required question is missing for one or more attendees: "${field.label}".`;
        }
      }

      continue;
    }

    if (!hasResponseValue(input.globalResponses[field.id])) {
      return `Required question is missing: "${field.label}".`;
    }
  }

  return null;
}
