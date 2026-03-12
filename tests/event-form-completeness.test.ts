import test from "node:test";
import assert from "node:assert/strict";
import { FormFieldScope } from "@prisma/client";

import { getMissingRequiredFieldLabels } from "../lib/event-form-completeness";

test("completeness requires global fields once and attendee-scoped fields for every attendee", () => {
  const missing = getMissingRequiredFieldLabels({
    requiredFields: [
      {
        id: "global-1",
        key: "club_note",
        label: "Club Note",
        description: null,
        options: null,
        fieldScope: FormFieldScope.GLOBAL,
      },
      {
        id: "attendee-1",
        key: "shirt_size",
        label: "Shirt Size",
        description: null,
        options: ["S", "M"],
        fieldScope: FormFieldScope.ATTENDEE,
      },
    ],
    attendees: [{ rosterMemberId: "a1" }, { rosterMemberId: "a2" }],
    formResponses: [
      { eventFormFieldId: "attendee-1", attendeeId: "a1" },
    ],
  });

  assert.deepEqual(missing, ["Club Note", "Shirt Size (1 attendee)"]);
});

test("completeness passes when required global and attendee-scoped fields are all present", () => {
  const missing = getMissingRequiredFieldLabels({
    requiredFields: [
      {
        id: "global-1",
        key: "club_note",
        label: "Club Note",
        description: null,
        options: null,
        fieldScope: FormFieldScope.GLOBAL,
      },
      {
        id: "attendee-1",
        key: "shirt_size",
        label: "Shirt Size",
        description: null,
        options: ["S", "M"],
        fieldScope: FormFieldScope.ATTENDEE,
      },
    ],
    attendees: [{ rosterMemberId: "a1" }, { rosterMemberId: "a2" }],
    formResponses: [
      { eventFormFieldId: "global-1", attendeeId: null },
      { eventFormFieldId: "attendee-1", attendeeId: "a1" },
      { eventFormFieldId: "attendee-1", attendeeId: "a2" },
    ],
  });

  assert.deepEqual(missing, []);
});
