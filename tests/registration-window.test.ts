import test from "node:test";
import assert from "node:assert/strict";

import { assertRegistrationWindow } from "../lib/registration-window";

const opensAt = new Date("2026-03-06T10:00:00.000Z");
const closesAt = new Date("2026-03-06T12:00:00.000Z");

test("registration window rejects before open", () => {
  assert.throws(
    () => assertRegistrationWindow(new Date("2026-03-06T09:59:59.999Z"), opensAt, closesAt),
    /Registration is not open yet/,
  );
});

test("registration window allows boundaries", () => {
  assert.doesNotThrow(() => assertRegistrationWindow(opensAt, opensAt, closesAt));
  assert.doesNotThrow(() => assertRegistrationWindow(closesAt, opensAt, closesAt));
});

test("registration window rejects after close", () => {
  assert.throws(
    () => assertRegistrationWindow(new Date("2026-03-06T12:00:00.001Z"), opensAt, closesAt),
    /Registration is closed/,
  );
});
