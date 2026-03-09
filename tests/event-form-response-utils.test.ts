import test from "node:test";
import assert from "node:assert/strict";

import { normalizeResponsesForPersistence } from "../lib/event-form-response-utils";

test("attendee-specific responses fan out when submitted as global", () => {
  const results = normalizeResponsesForPersistence({
    responses: [{ fieldId: "f-attendee", attendeeId: null, value: "Y" }],
    dynamicFieldRules: [
      {
        id: "f-attendee",
        key: "attendee_medical",
        label: "Medical",
        description: null,
        type: "SHORT_TEXT",
        isRequired: true,
        options: { attendeeSpecific: true },
      },
    ],
    validFieldIds: new Set(["f-attendee"]),
    attendeeIdSet: new Set(["a1", "a2"]),
  });

  assert.deepEqual(results, [
    { eventFormFieldId: "f-attendee", attendeeId: "a1", value: "Y" },
    { eventFormFieldId: "f-attendee", attendeeId: "a2", value: "Y" },
  ]);
});
