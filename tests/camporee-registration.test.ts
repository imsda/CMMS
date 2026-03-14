import test from "node:test";
import assert from "node:assert/strict";
import { EventWorkflowType } from "@prisma/client";

import {
  EMPTY_CAMPOREE_REGISTRATION,
  parseCamporeeRegistrationPayload,
  validateCamporeeRegistrationPayload,
} from "../lib/camporee-registration";
import { isCamporeeWorkflowEvent } from "../lib/camporee-workflow";

test("camporee workflow detection supports explicit and legacy event markers", () => {
  assert.equal(
    isCamporeeWorkflowEvent({
      workflowType: EventWorkflowType.CAMPOREE,
      dynamicFields: [],
    }),
    true,
  );

  assert.equal(
    isCamporeeWorkflowEvent({
      workflowType: EventWorkflowType.STANDARD,
      dynamicFields: [{ key: "campsite_type" }],
    }),
    true,
  );
});

test("camporee payload parsing normalizes lists and numbers", () => {
  const payload = parseCamporeeRegistrationPayload(
    JSON.stringify({
      ...EMPTY_CAMPOREE_REGISTRATION,
      attendeeIds: ["a1", "a1", "a2"],
      trailerCount: "3",
      dutyPreferences: ["Drill", "Drill", "Kitchen Duty"],
    }),
  );

  assert.deepEqual(payload.attendeeIds, ["a1", "a2"]);
  assert.equal(payload.trailerCount, 3);
  assert.deepEqual(payload.dutyPreferences, ["Drill", "Kitchen Duty"]);
});

test("camporee payload validation requires submission essentials", () => {
  assert.throws(() =>
    validateCamporeeRegistrationPayload(EMPTY_CAMPOREE_REGISTRATION, {
      requireCompleteSubmission: true,
    }),
  );

  assert.doesNotThrow(() =>
    validateCamporeeRegistrationPayload(
      {
        ...EMPTY_CAMPOREE_REGISTRATION,
        attendeeIds: ["a1"],
        primaryContactName: "Jordan Lee",
        primaryContactPhone: "555-0101",
        tentSummary: "4 tents, 1 canopy",
        squareFootageNeeded: 900,
        emergencyContactName: "Jordan Lee",
        emergencyContactPhone: "555-0101",
      },
      {
        requireCompleteSubmission: true,
      },
    ),
  );
});
