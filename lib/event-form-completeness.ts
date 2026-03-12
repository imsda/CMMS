import { FormFieldScope, type Prisma } from "@prisma/client";

import { isAttendeeScopedField, type EventFieldScopeCarrier } from "./event-form-scope";

type RequiredField = EventFieldScopeCarrier & {
  id: string;
  label: string;
  fieldScope: FormFieldScope;
};

type RegistrationAttendee = {
  rosterMemberId: string;
};

type RegistrationResponse = {
  attendeeId: string | null;
  eventFormFieldId: string;
};

export function getMissingRequiredFieldLabels(input: {
  requiredFields: RequiredField[];
  attendees: RegistrationAttendee[];
  formResponses: RegistrationResponse[];
}) {
  const requiredGlobalFields = input.requiredFields.filter(
    (field) => field.fieldScope === FormFieldScope.GLOBAL,
  );
  const requiredAttendeeFields = input.requiredFields.filter((field) =>
    isAttendeeScopedField(field),
  );

  const globalResponses = new Set(
    input.formResponses
      .filter((response) => response.attendeeId === null)
      .map((response) => response.eventFormFieldId),
  );

  const attendeeResponsesByField = input.formResponses.reduce<Record<string, Set<string>>>(
    (map, response) => {
      if (!response.attendeeId) {
        return map;
      }

      if (!map[response.eventFormFieldId]) {
        map[response.eventFormFieldId] = new Set();
      }

      map[response.eventFormFieldId].add(response.attendeeId);
      return map;
    },
    {},
  );

  const missingRequiredFields: string[] = [];

  for (const field of requiredGlobalFields) {
    if (!globalResponses.has(field.id)) {
      missingRequiredFields.push(field.label);
    }
  }

  for (const field of requiredAttendeeFields) {
    const responsesForField = attendeeResponsesByField[field.id] ?? new Set<string>();
    const missingAttendeeCount = input.attendees.reduce((count, attendee) => {
      if (responsesForField.has(attendee.rosterMemberId)) {
        return count;
      }

      return count + 1;
    }, 0);

    if (missingAttendeeCount > 0) {
      missingRequiredFields.push(
        `${field.label} (${missingAttendeeCount} attendee${missingAttendeeCount > 1 ? "s" : ""})`,
      );
    }
  }

  return missingRequiredFields;
}
