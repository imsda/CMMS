import test from "node:test";
import assert from "node:assert/strict";
import { FormFieldScope } from "@prisma/client";

import {
  bootstrapRegistrationResponses,
  serializeRegistrationResponses,
  validateRequiredRegistrationResponses,
} from "../lib/event-form-responses";

test("bootstraps attendee responses without collisions", () => {
  const state = bootstrapRegistrationResponses([
    { fieldId: "global-1", attendeeId: null, value: "Club note" },
    { fieldId: "attendee-1", attendeeId: "a1", value: "Alpha" },
    { fieldId: "attendee-1", attendeeId: "a2", value: "Beta" },
  ]);

  assert.equal(state.globalResponses["global-1"], "Club note");
  assert.equal(state.attendeeResponses.a1["attendee-1"], "Alpha");
  assert.equal(state.attendeeResponses.a2["attendee-1"], "Beta");
});

test("serializes attendee-scoped answers per attendee and keeps global answers single-instance", () => {
  const serialized = serializeRegistrationResponses({
    fields: [
      {
        id: "global-1",
        key: "club_note",
        label: "Club Note",
        description: null,
        options: null,
        isRequired: true,
        fieldScope: FormFieldScope.GLOBAL,
      },
      {
        id: "attendee-1",
        key: "shirt_size",
        label: "Shirt Size",
        description: null,
        options: ["S", "M"],
        isRequired: true,
        fieldScope: FormFieldScope.ATTENDEE,
      },
    ],
    selectedAttendeeIds: ["a1", "a2"],
    globalResponses: {
      "global-1": "Bring banner",
    },
    attendeeResponses: {
      a1: { "attendee-1": "S" },
      a2: { "attendee-1": "M" },
    },
  });

  assert.deepEqual(serialized.responses, [
    { fieldId: "global-1", attendeeId: null, value: "Bring banner" },
    { fieldId: "attendee-1", attendeeId: "a1", value: "S" },
    { fieldId: "attendee-1", attendeeId: "a2", value: "M" },
  ]);
});

test("editing a registration drops attendee-scoped responses for deselected attendees", () => {
  const serialized = serializeRegistrationResponses({
    fields: [
      {
        id: "attendee-1",
        key: "shirt_size",
        label: "Shirt Size",
        description: null,
        options: ["S", "M"],
        isRequired: true,
        fieldScope: FormFieldScope.ATTENDEE,
      },
    ],
    selectedAttendeeIds: ["a1"],
    globalResponses: {},
    attendeeResponses: {
      a1: { "attendee-1": "S" },
      a2: { "attendee-1": "M" },
    },
  });

  assert.deepEqual(serialized.attendeeIds, ["a1"]);
  assert.deepEqual(serialized.responses, [
    { fieldId: "attendee-1", attendeeId: "a1", value: "S" },
  ]);
});

test("validates required attendee-scoped answers for every selected attendee", () => {
  const error = validateRequiredRegistrationResponses({
    fields: [
      {
        id: "attendee-1",
        key: "shirt_size",
        label: "Shirt Size",
        description: null,
        options: ["S", "M"],
        isRequired: true,
        fieldScope: FormFieldScope.ATTENDEE,
      },
    ],
    selectedAttendeeIds: ["a1", "a2"],
    globalResponses: {},
    attendeeResponses: {
      a1: { "attendee-1": "S" },
    },
  });

  assert.match(error ?? "", /Shirt Size/);
});
