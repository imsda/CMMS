import test from "node:test";
import assert from "node:assert/strict";

import {
  assertLoginAllowed,
  clearFailedLoginAttempts,
  recordFailedLoginAttempt,
} from "../lib/auth-rate-limit";
import { prisma } from "../lib/prisma";
import {
  disconnectIntegrationPrisma,
  hasIntegrationDatabase,
  resetIntegrationDatabase,
} from "./integration-helpers";

test("auth throttling persists buckets in the database and preserves the shared IP bucket after success cleanup", { skip: !hasIntegrationDatabase }, async () => {
  await resetIntegrationDatabase();

  const email = "director@example.org";
  const ip = "203.0.113.10";

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await recordFailedLoginAttempt(email, ip);
  }

  await assert.rejects(() => assertLoginAllowed(email, ip));

  const beforeClear = await prisma.authRateLimitBucket.findMany();
  assert.equal(beforeClear.length, 2);

  await clearFailedLoginAttempts(email, ip);

  const afterClear = await prisma.authRateLimitBucket.findMany({
    orderBy: {
      scopeType: "asc",
    },
  });

  assert.equal(afterClear.length, 1);
  assert.equal(afterClear[0]?.scopeType, "IP");
});

test.after(async () => {
  await disconnectIntegrationPrisma();
});
