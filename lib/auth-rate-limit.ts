import { AuthRateLimitScope, Prisma } from "@prisma/client";
import { CredentialsSignin } from "next-auth";
import { createHash } from "node:crypto";

import { prisma } from "./prisma";

const WINDOW_MS = 15 * 60 * 1000;
const EMAIL_IP_MAX_ATTEMPTS = 5;
const IP_MAX_ATTEMPTS = 20;
const BLOCK_MS = 15 * 60 * 1000;
const RATE_LIMIT_WRITE_RETRIES = 3;

export const AUTH_RATE_LIMIT_WINDOW_MS = WINDOW_MS;
export const AUTH_RATE_LIMIT_BLOCK_MS = BLOCK_MS;

export class LoginRateLimitError extends CredentialsSignin {
  code = "rate_limited";
}

export function normalizeEmailAddress(value: string) {
  return value.trim().toLowerCase();
}

export function getClientIpFromHeaders(headers: Headers) {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }

  return (
    headers.get("x-real-ip") ??
    headers.get("cf-connecting-ip") ??
    "unknown"
  ).trim();
}

type BucketStateInput = {
  attemptCount: number;
  windowStartedAt: Date;
  blockedUntil: Date | null;
};

export function evaluateRateLimitBucket(
  current: BucketStateInput | null,
  now: Date,
  maxAttempts: number,
) {
  if (!current) {
    return {
      attemptCount: 1,
      windowStartedAt: now,
      blockedUntil: null,
      blocked: false,
    };
  }

  if (current.blockedUntil && current.blockedUntil > now) {
    return {
      attemptCount: current.attemptCount,
      windowStartedAt: current.windowStartedAt,
      blockedUntil: current.blockedUntil,
      blocked: true,
    };
  }

  if (now.getTime() - current.windowStartedAt.getTime() >= WINDOW_MS) {
    return {
      attemptCount: 1,
      windowStartedAt: now,
      blockedUntil: null,
      blocked: false,
    };
  }

  const attemptCount = current.attemptCount + 1;
  const blockedUntil = attemptCount >= maxAttempts ? new Date(now.getTime() + BLOCK_MS) : null;

  return {
    attemptCount,
    windowStartedAt: current.windowStartedAt,
    blockedUntil,
    blocked: blockedUntil !== null,
  };
}

function hashKey(scopeType: AuthRateLimitScope, rawValue: string) {
  return createHash("sha256")
    .update(`${scopeType}:${rawValue}`)
    .digest("hex");
}

function getBucketDefinitions(email: string, clientIp: string) {
  const normalizedEmail = normalizeEmailAddress(email);

  return [
    {
      scopeType: AuthRateLimitScope.EMAIL_IP,
      maxAttempts: EMAIL_IP_MAX_ATTEMPTS,
      keyHash: hashKey(AuthRateLimitScope.EMAIL_IP, `${normalizedEmail}|${clientIp}`),
    },
    {
      scopeType: AuthRateLimitScope.IP,
      maxAttempts: IP_MAX_ATTEMPTS,
      keyHash: hashKey(AuthRateLimitScope.IP, clientIp),
    },
  ];
}

export function getBucketsToClearAfterSuccessfulLogin(email: string, clientIp: string) {
  return getBucketDefinitions(email, clientIp).filter(
    (bucket) => bucket.scopeType === AuthRateLimitScope.EMAIL_IP,
  );
}

export function buildExpiredAuthRateLimitBucketWhere(now = new Date()): Prisma.AuthRateLimitBucketWhereInput {
  const staleWindowStart = new Date(now.getTime() - WINDOW_MS);

  return {
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
          lt: staleWindowStart,
        },
      },
    ],
  };
}

function isRetryableTransactionError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2034" || error.code === "P2002")
  );
}

export async function assertLoginAllowed(email: string, clientIp: string) {
  const bucketDefinitions = getBucketDefinitions(email, clientIp);
  const buckets = await prisma.authRateLimitBucket.findMany({
    where: {
      keyHash: {
        in: bucketDefinitions.map((bucket) => bucket.keyHash),
      },
    },
  });

  const now = new Date();

  for (const definition of bucketDefinitions) {
    const bucket = buckets.find((entry) => entry.keyHash === definition.keyHash);

    if (bucket?.blockedUntil && bucket.blockedUntil > now) {
      throw new LoginRateLimitError();
    }
  }
}

export async function recordFailedLoginAttempt(email: string, clientIp: string) {
  const bucketDefinitions = getBucketDefinitions(email, clientIp);

  for (let attempt = 0; attempt < RATE_LIMIT_WRITE_RETRIES; attempt += 1) {
    const now = new Date();

    try {
      await prisma.$transaction(
        async (tx) => {
          for (const definition of bucketDefinitions) {
            const current = await tx.authRateLimitBucket.findUnique({
              where: {
                keyHash: definition.keyHash,
              },
              select: {
                attemptCount: true,
                windowStartedAt: true,
                blockedUntil: true,
              },
            });
            const next = evaluateRateLimitBucket(current, now, definition.maxAttempts);

            if (!current) {
              await tx.authRateLimitBucket.create({
                data: {
                  keyHash: definition.keyHash,
                  scopeType: definition.scopeType,
                  attemptCount: next.attemptCount,
                  windowStartedAt: next.windowStartedAt,
                  blockedUntil: next.blockedUntil,
                },
              });
              continue;
            }

            await tx.authRateLimitBucket.update({
              where: {
                keyHash: definition.keyHash,
              },
              data: {
                attemptCount: next.attemptCount,
                windowStartedAt: next.windowStartedAt,
                blockedUntil: next.blockedUntil,
              },
            });
          }
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );

      return;
    } catch (error) {
      if (attempt < RATE_LIMIT_WRITE_RETRIES - 1 && isRetryableTransactionError(error)) {
        continue;
      }

      throw error;
    }
  }
}

export async function clearFailedLoginAttempts(email: string, clientIp: string) {
  const bucketDefinitions = getBucketsToClearAfterSuccessfulLogin(email, clientIp);

  await prisma.authRateLimitBucket.deleteMany({
    where: {
      keyHash: {
        in: bucketDefinitions.map((bucket) => bucket.keyHash),
      },
    },
  });
}
