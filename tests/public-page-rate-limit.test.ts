import test from "node:test";
import assert from "node:assert/strict";

// Test the public page rate limiter logic (pure, no DB)

const PUBLIC_PAGE_WINDOW_MS = 15 * 60 * 1000;
const PUBLIC_PAGE_MAX_REQUESTS = 120;

type BucketState = {
  attemptCount: number;
  windowStartedAt: Date;
  blockedUntil: Date | null;
};

function evaluatePublicBucket(
  bucket: BucketState | null,
  now: Date,
): { allowed: boolean; nextCount: number; windowExpired: boolean } {
  if (bucket?.blockedUntil && bucket.blockedUntil > now) {
    return { allowed: false, nextCount: bucket.attemptCount, windowExpired: false };
  }

  const windowExpired =
    !bucket ||
    now.getTime() - bucket.windowStartedAt.getTime() > PUBLIC_PAGE_WINDOW_MS;

  const nextCount = windowExpired ? 1 : bucket.attemptCount + 1;
  const allowed = nextCount <= PUBLIC_PAGE_MAX_REQUESTS;

  return { allowed, nextCount, windowExpired };
}

test("first request with no bucket is always allowed", () => {
  const result = evaluatePublicBucket(null, new Date());
  assert.equal(result.allowed, true);
  assert.equal(result.nextCount, 1);
  assert.equal(result.windowExpired, true);
});

test("request within limit is allowed", () => {
  const now = new Date();
  const bucket: BucketState = {
    attemptCount: 50,
    windowStartedAt: now,
    blockedUntil: null,
  };
  const result = evaluatePublicBucket(bucket, now);
  assert.equal(result.allowed, true);
  assert.equal(result.nextCount, 51);
});

test("request at exactly the limit is allowed (boundary)", () => {
  const now = new Date();
  const bucket: BucketState = {
    attemptCount: 119,
    windowStartedAt: now,
    blockedUntil: null,
  };
  const result = evaluatePublicBucket(bucket, now);
  assert.equal(result.allowed, true);
  assert.equal(result.nextCount, 120);
});

test("request exceeding limit is blocked", () => {
  const now = new Date();
  const bucket: BucketState = {
    attemptCount: 120,
    windowStartedAt: now,
    blockedUntil: null,
  };
  const result = evaluatePublicBucket(bucket, now);
  assert.equal(result.allowed, false);
  assert.equal(result.nextCount, 121);
});

test("already blocked request is rejected immediately", () => {
  const now = new Date();
  const future = new Date(now.getTime() + 10 * 60 * 1000);
  const bucket: BucketState = {
    attemptCount: 200,
    windowStartedAt: new Date(now.getTime() - 5 * 60 * 1000),
    blockedUntil: future,
  };
  const result = evaluatePublicBucket(bucket, now);
  assert.equal(result.allowed, false);
});

test("window expiry resets the counter", () => {
  const now = new Date();
  const longAgo = new Date(now.getTime() - PUBLIC_PAGE_WINDOW_MS - 1000);
  const bucket: BucketState = {
    attemptCount: 999,
    windowStartedAt: longAgo,
    blockedUntil: null,
  };
  const result = evaluatePublicBucket(bucket, now);
  assert.equal(result.allowed, true);
  assert.equal(result.nextCount, 1);
  assert.equal(result.windowExpired, true);
});
