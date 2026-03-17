import test from "node:test";
import assert from "node:assert/strict";

// Unit tests for batch preference payload validation helpers (pure logic, no DB)

function deduplicateOfferingIds(offeringIds: string[]): string[] {
  return Array.from(new Set(offeringIds.filter((id) => id.length > 0)));
}

function validateBatchPayload(input: {
  eventId: string;
  registrationId: string;
  preferences: Array<{ registrationAttendeeId: string; timeslotId: string; offeringIds: string[] }>;
}): string | null {
  if (!input.eventId || input.eventId.trim().length === 0) return "eventId is required";
  if (!input.registrationId || input.registrationId.trim().length === 0)
    return "registrationId is required";

  for (const pref of input.preferences) {
    if (!pref.registrationAttendeeId || pref.registrationAttendeeId.trim().length === 0)
      return "registrationAttendeeId is required";
    if (!pref.timeslotId || pref.timeslotId.trim().length === 0) return "timeslotId is required";
  }

  return null;
}

function buildPreferenceRecords(
  eventId: string,
  timeslotId: string,
  registrationAttendeeId: string,
  offeringIds: string[],
) {
  const unique = deduplicateOfferingIds(offeringIds);
  return unique.map((eventClassOfferingId, index) => ({
    eventId,
    timeslotId,
    registrationAttendeeId,
    eventClassOfferingId,
    rank: index + 1,
  }));
}

test("deduplicateOfferingIds removes duplicates and empty strings", () => {
  assert.deepEqual(deduplicateOfferingIds(["a", "b", "a", "", "c"]), ["a", "b", "c"]);
  assert.deepEqual(deduplicateOfferingIds([]), []);
  assert.deepEqual(deduplicateOfferingIds(["", ""]), []);
});

test("buildPreferenceRecords assigns ascending ranks", () => {
  const records = buildPreferenceRecords("event-1", "slot-1", "attendee-1", ["off-a", "off-b", "off-c"]);

  assert.equal(records.length, 3);
  assert.equal(records[0].rank, 1);
  assert.equal(records[0].eventClassOfferingId, "off-a");
  assert.equal(records[1].rank, 2);
  assert.equal(records[2].rank, 3);
  assert.equal(records[2].eventClassOfferingId, "off-c");
});

test("buildPreferenceRecords deduplicates offerings", () => {
  const records = buildPreferenceRecords("event-1", "slot-1", "attendee-1", [
    "off-a",
    "off-a",
    "off-b",
  ]);
  assert.equal(records.length, 2);
  assert.equal(records[0].eventClassOfferingId, "off-a");
  assert.equal(records[1].eventClassOfferingId, "off-b");
});

test("buildPreferenceRecords returns empty array when no offering IDs", () => {
  const records = buildPreferenceRecords("event-1", "slot-1", "attendee-1", []);
  assert.equal(records.length, 0);
});

test("validateBatchPayload rejects missing eventId", () => {
  const err = validateBatchPayload({
    eventId: "",
    registrationId: "reg-1",
    preferences: [],
  });
  assert.match(err ?? "", /eventId/);
});

test("validateBatchPayload rejects missing registrationId", () => {
  const err = validateBatchPayload({
    eventId: "event-1",
    registrationId: "  ",
    preferences: [],
  });
  assert.match(err ?? "", /registrationId/);
});

test("validateBatchPayload rejects preference with empty attendeeId", () => {
  const err = validateBatchPayload({
    eventId: "event-1",
    registrationId: "reg-1",
    preferences: [{ registrationAttendeeId: "", timeslotId: "slot-1", offeringIds: [] }],
  });
  assert.match(err ?? "", /registrationAttendeeId/);
});

test("validateBatchPayload accepts valid payload", () => {
  const err = validateBatchPayload({
    eventId: "event-1",
    registrationId: "reg-1",
    preferences: [
      { registrationAttendeeId: "att-1", timeslotId: "slot-1", offeringIds: ["off-a"] },
      { registrationAttendeeId: "att-2", timeslotId: "slot-1", offeringIds: [] },
    ],
  });
  assert.equal(err, null);
});
