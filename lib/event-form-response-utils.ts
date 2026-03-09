import { isAttendeeSpecificField } from "./event-form-scope";

export type DynamicFieldRule = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  type: string;
  isRequired: boolean;
  options: unknown;
};

export type IncomingResponse = {
  fieldId: string;
  attendeeId: string | null;
  value: unknown;
};

export type PersistedResponse = {
  eventFormFieldId: string;
  attendeeId: string | null;
  value: unknown;
};

export function normalizeResponsesForPersistence(args: {
  responses: IncomingResponse[];
  dynamicFieldRules: DynamicFieldRule[];
  validFieldIds: Set<string>;
  attendeeIdSet: Set<string>;
}) {
  const fieldById = new Map(args.dynamicFieldRules.map((field) => [field.id, field]));
  const output: PersistedResponse[] = [];

  for (const response of args.responses) {
    if (!args.validFieldIds.has(response.fieldId)) {
      continue;
    }

    const field = fieldById.get(response.fieldId);
    if (!field) {
      continue;
    }

    if (!isAttendeeSpecificField(field)) {
      output.push({
        eventFormFieldId: response.fieldId,
        attendeeId: null,
        value: response.value,
      });
      continue;
    }

    if (response.attendeeId && args.attendeeIdSet.has(response.attendeeId)) {
      output.push({
        eventFormFieldId: response.fieldId,
        attendeeId: response.attendeeId,
        value: response.value,
      });
      continue;
    }

    for (const attendeeId of args.attendeeIdSet) {
      output.push({
        eventFormFieldId: response.fieldId,
        attendeeId,
        value: response.value,
      });
    }
  }

  const deduped = new Map<string, PersistedResponse>();
  for (const item of output) {
    deduped.set(`${item.eventFormFieldId}::${item.attendeeId ?? "global"}`, item);
  }

  return Array.from(deduped.values());
}
