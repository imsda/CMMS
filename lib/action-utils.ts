/**
 * Detects Next.js redirect errors thrown by `redirect()` inside try-catch blocks.
 * Re-throw these so they propagate correctly instead of being swallowed.
 */
export function isRedirectError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}
