import test from "node:test";
import assert from "node:assert/strict";
import { AuthRateLimitScope } from "@prisma/client";

import {
  AUTH_RATE_LIMIT_WINDOW_MS,
  buildExpiredAuthRateLimitBucketWhere,
  evaluateRateLimitBucket,
  getBucketsToClearAfterSuccessfulLogin,
  LoginRateLimitError,
  normalizeEmailAddress,
} from "../lib/auth-rate-limit";
import { buildLoginErrorRedirectPath } from "../lib/auth-error-redirect";

test("normalizes email addresses consistently for lookup and throttling", () => {
  assert.equal(normalizeEmailAddress(" Director@Club.Org "), "director@club.org");
});

test("rate limit bucket blocks after repeated failures inside the active window", () => {
  const now = new Date("2026-03-12T12:00:00.000Z");

  const afterFirst = evaluateRateLimitBucket(null, now, 3);
  assert.equal(afterFirst.attemptCount, 1);
  assert.equal(afterFirst.blocked, false);

  const afterSecond = evaluateRateLimitBucket(
    {
      attemptCount: afterFirst.attemptCount,
      windowStartedAt: afterFirst.windowStartedAt,
      blockedUntil: afterFirst.blockedUntil,
    },
    new Date("2026-03-12T12:01:00.000Z"),
    3,
  );
  assert.equal(afterSecond.attemptCount, 2);
  assert.equal(afterSecond.blocked, false);

  const afterThird = evaluateRateLimitBucket(
    {
      attemptCount: afterSecond.attemptCount,
      windowStartedAt: afterSecond.windowStartedAt,
      blockedUntil: afterSecond.blockedUntil,
    },
    new Date("2026-03-12T12:02:00.000Z"),
    3,
  );
  assert.equal(afterThird.attemptCount, 3);
  assert.equal(afterThird.blocked, true);
  assert.notEqual(afterThird.blockedUntil, null);
});

test("rate limit bucket resets after the window expires", () => {
  const next = evaluateRateLimitBucket(
    {
      attemptCount: 4,
      windowStartedAt: new Date("2026-03-12T12:00:00.000Z"),
      blockedUntil: null,
    },
    new Date("2026-03-12T12:20:00.000Z"),
    5,
  );

  assert.equal(next.attemptCount, 1);
  assert.equal(next.blocked, false);
});

test("successful login clears only the email and IP bucket", () => {
  const buckets = getBucketsToClearAfterSuccessfulLogin("director@club.org", "203.0.113.10");

  assert.equal(buckets.length, 1);
  assert.equal(buckets[0]?.scopeType, AuthRateLimitScope.EMAIL_IP);
});

test("rate limit errors expose a dedicated redirect code", () => {
  const error = new LoginRateLimitError();

  assert.equal(error.type, "CredentialsSignin");
  assert.equal(error.code, "rate_limited");
  assert.equal(
    buildLoginErrorRedirectPath(error),
    "/login?error=CredentialsSignin&code=rate_limited",
  );
});

test("auth cleanup removes only expired buckets", () => {
  const now = new Date("2026-03-12T12:30:00.000Z");
  const where = buildExpiredAuthRateLimitBucketWhere(now);

  assert.deepEqual(where, {
    OR: [
      {
        blockedUntil: {
          not: null,
          lt: now,
        },
      },
      {
        blockedUntil: null,
        windowStartedAt: {
          lt: new Date(now.getTime() - AUTH_RATE_LIMIT_WINDOW_MS),
        },
      },
    ],
  });
});
