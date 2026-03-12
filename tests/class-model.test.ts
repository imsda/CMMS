import test from "node:test";
import assert from "node:assert/strict";

import {
  buildClassAttendanceUpdate,
  findEventEnrollmentConflict,
  formatEnrollmentConflictMessage,
  getSeatsLeft,
  isOfferingFull,
} from "../lib/class-model";

test("detects a conflicting enrollment when an attendee is already assigned to another event class", () => {
  const conflict = findEventEnrollmentConflict(
    [
      {
        eventClassOfferingId: "offering-1",
        classTitle: "Camping Skills",
        classCode: "HONOR-1",
      },
    ],
    "offering-2",
  );

  assert.deepEqual(conflict, {
    eventClassOfferingId: "offering-1",
    classTitle: "Camping Skills",
    classCode: "HONOR-1",
  });
  assert.match(formatEnrollmentConflictMessage(conflict!), /Camping Skills/);
});

test("does not report a conflict when the attendee is already enrolled in the same offering", () => {
  const conflict = findEventEnrollmentConflict(
    [
      {
        eventClassOfferingId: "offering-1",
        classTitle: "Camping Skills",
        classCode: "HONOR-1",
      },
    ],
    "offering-1",
  );

  assert.equal(conflict, null);
});

test("computes capacity state without oversubscription drift", () => {
  assert.equal(getSeatsLeft(null, 999), null);
  assert.equal(getSeatsLeft(10, 6), 4);
  assert.equal(getSeatsLeft(10, 12), 0);
  assert.equal(isOfferingFull(10, 10), true);
  assert.equal(isOfferingFull(10, 9), false);
});

test("class attendance updates use a dedicated attendedAt field", () => {
  const marked = buildClassAttendanceUpdate(true, new Date("2026-03-12T12:00:00.000Z"));
  const cleared = buildClassAttendanceUpdate(false, new Date("2026-03-12T12:00:00.000Z"));

  assert.deepEqual(marked, {
    attendedAt: new Date("2026-03-12T12:00:00.000Z"),
  });
  assert.deepEqual(cleared, {
    attendedAt: null,
  });
});
