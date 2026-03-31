import { createHash } from "node:crypto";

import { AuthRateLimitScope } from "@prisma/client";

import { getClientIpFromHeaders } from "./auth-rate-limit";
import { prisma } from "./prisma";

// 120 requests per 15-minute window for public pages
const PUBLIC_PAGE_WINDOW_MS = 15 * 60 * 1000;
const PUBLIC_PAGE_MAX_REQUESTS = 120;

export { getClientIpFromHeaders };

/**
 * Check whether the given IP address is within the public page rate limit.
 * Uses the AuthRateLimitBucket table with a dedicated key prefix so it never
 * collides with auth rate-limit buckets.
 *
 * Returns true when the request is allowed, false when it should be blocked.
 */
export async function checkPublicPageRateLimit(ip: string): Promise<boolean> {
  const keyHash = createHash("sha256")
    .update(`public_page_ip:${ip}`)
    .digest("hex");

  const now = new Date();

  try {
    const bucket = await prisma.authRateLimitBucket.findUnique({
      where: { keyHash },
      select: {
        attemptCount: true,
        windowStartedAt: true,
        blockedUntil: true,
      },
    });

    // Already blocked?
    if (bucket?.blockedUntil && bucket.blockedUntil > now) {
      return false;
    }

    const windowExpired =
      !bucket ||
      now.getTime() - bucket.windowStartedAt.getTime() > PUBLIC_PAGE_WINDOW_MS;

    const nextCount = windowExpired ? 1 : bucket.attemptCount + 1;
    const blocked = nextCount > PUBLIC_PAGE_MAX_REQUESTS;

    await prisma.authRateLimitBucket.upsert({
      where: { keyHash },
      create: {
        keyHash,
        scopeType: AuthRateLimitScope.IP,
        attemptCount: 1,
        windowStartedAt: now,
        blockedUntil: null,
      },
      update: {
        attemptCount: windowExpired ? 1 : { increment: 1 },
        windowStartedAt: windowExpired ? now : undefined,
        blockedUntil: blocked
          ? new Date(now.getTime() + PUBLIC_PAGE_WINDOW_MS)
          : null,
      },
    });

    return !blocked;
  } catch {
    // On DB error, allow the request through rather than blocking legitimate users
    return true;
  }
}
