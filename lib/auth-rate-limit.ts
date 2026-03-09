type AttemptRecord = {
  count: number;
  windowStartedAt: number;
  blockedUntil?: number;
};

const attempts = new Map<string, AttemptRecord>();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const BLOCK_MS = 15 * 60 * 1000;

export function getRateLimitKey(email: string, ipAddress?: string | null) {
  return `${email.toLowerCase()}::${ipAddress ?? "unknown"}`;
}

export function assertLoginRateLimit(key: string, now = Date.now()) {
  const entry = attempts.get(key);
  if (!entry) {
    return;
  }

  if (entry.blockedUntil && now < entry.blockedUntil) {
    throw new Error("Too many failed login attempts. Please try again later.");
  }
}

export function recordFailedLoginAttempt(key: string, now = Date.now()) {
  const current = attempts.get(key);

  if (!current || now - current.windowStartedAt > WINDOW_MS) {
    attempts.set(key, {
      count: 1,
      windowStartedAt: now,
    });
    return;
  }

  const nextCount = current.count + 1;
  const updated: AttemptRecord = {
    ...current,
    count: nextCount,
  };

  if (nextCount >= MAX_ATTEMPTS) {
    updated.blockedUntil = now + BLOCK_MS;
  }

  attempts.set(key, updated);
}

export function clearFailedLoginAttempts(key: string) {
  attempts.delete(key);
}

export function __resetLoginRateLimitForTests() {
  attempts.clear();
}
