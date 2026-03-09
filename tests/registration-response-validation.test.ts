import test from "node:test";
import assert from "node:assert/strict";

import { validateDynamicFieldResponses } from "../lib/registration-response-validation";

const noopValidate = () => {};
const hasValue = (value: unknown) => !(value === null || typeof value === "undefined" || value === "");

test("requires attendee-specific value for each selected attendee", () => {
  assert.throws(
    () =>
      validateDynamicFieldResponses({
        fields: [
          {
            id: "f1",
            key: "attendee_allergy",
            label: "Allergy",
            description: null,
            type: "SHORT_TEXT",
            isRequired: true,
            options: { attendeeSpecific: true },
          },
        ],
        responses: [{ eventFormFieldId: "f1", attendeeId: "a1", value: "none" }],
        attendeeIds: ["a1", "a2"],
        hasResponseValue: hasValue,
        validateResponseValue: noopValidate,
      }),
    /Required attendee question is missing/,
  );
});

test("accepts attendee-specific values when all selected attendees have responses", () => {
  assert.doesNotThrow(() =>
    validateDynamicFieldResponses({
      fields: [
        {
          id: "f1",
          key: "attendee_allergy",
          label: "Allergy",
          description: null,
          type: "SHORT_TEXT",
          isRequired: true,
          options: { attendeeSpecific: true },
        },
      ],
      responses: [
        { eventFormFieldId: "f1", attendeeId: "a1", value: "none" },
        { eventFormFieldId: "f1", attendeeId: "a2", value: "peanut" },
      ],
      attendeeIds: ["a1", "a2"],
      hasResponseValue: hasValue,
      validateResponseValue: noopValidate,
    }),
  );
});
