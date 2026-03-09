import test from "node:test";
import assert from "node:assert/strict";

import {
  __resetLoginRateLimitForTests,
  assertLoginRateLimit,
  getRateLimitKey,
  recordFailedLoginAttempt,
} from "../lib/auth-rate-limit";

test("rate limiter blocks after repeated failures", () => {
  __resetLoginRateLimitForTests();
  const key = getRateLimitKey("person@example.com", "1.1.1.1");
  const now = Date.now();

  for (let i = 0; i < 5; i += 1) {
    recordFailedLoginAttempt(key, now + i);
  }

  assert.throws(() => assertLoginRateLimit(key, now + 10), /Too many failed login attempts/);
});
