import test from "node:test";
import assert from "node:assert/strict";
import { RegistrationStatus } from "@prisma/client";

import {
  assertRegistrationCanBeCheckedIn,
  assertRegistrationCanPersist,
  getRegistrationLifecycleState,
} from "../lib/registration-lifecycle";

const opensAt = new Date("2026-03-10T00:00:00.000Z");
const closesAt = new Date("2026-03-20T23:59:59.000Z");

test("draft registrations can be edited only while the window is open", () => {
  const state = getRegistrationLifecycleState({
    registrationOpensAt: opensAt,
    registrationClosesAt: closesAt,
    registrationStatus: RegistrationStatus.DRAFT,
    now: new Date("2026-03-12T12:00:00.000Z"),
  });

  assert.equal(state.canEdit, true);
  assert.equal(state.isLocked, false);

  assert.throws(() =>
    assertRegistrationCanPersist({
      registrationOpensAt: opensAt,
      registrationClosesAt: closesAt,
      registrationStatus: RegistrationStatus.DRAFT,
      now: new Date("2026-03-25T12:00:00.000Z"),
    }),
  );
});

test("submitted and approved registrations are locked against further writes", () => {
  assert.throws(() =>
    assertRegistrationCanPersist({
      registrationOpensAt: opensAt,
      registrationClosesAt: closesAt,
      registrationStatus: RegistrationStatus.SUBMITTED,
      now: new Date("2026-03-12T12:00:00.000Z"),
    }),
  );

  assert.throws(() =>
    assertRegistrationCanPersist({
      registrationOpensAt: opensAt,
      registrationClosesAt: closesAt,
      registrationStatus: RegistrationStatus.REVIEWED,
      now: new Date("2026-03-12T12:00:00.000Z"),
    }),
  );

  assert.throws(() => assertRegistrationCanBeCheckedIn(RegistrationStatus.DRAFT));
  assert.doesNotThrow(() => assertRegistrationCanBeCheckedIn(RegistrationStatus.SUBMITTED));
});

test("needs changes registrations reopen editing within the active window", () => {
  const state = getRegistrationLifecycleState({
    registrationOpensAt: opensAt,
    registrationClosesAt: closesAt,
    registrationStatus: RegistrationStatus.NEEDS_CHANGES,
    now: new Date("2026-03-12T12:00:00.000Z"),
  });

  assert.equal(state.canEdit, true);
  assert.equal(state.isLocked, false);
});
