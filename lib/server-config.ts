export function validateRequiredServerConfigOnStartup() {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const rawKey = process.env.MEDICAL_ENCRYPTION_KEY;

  if (!rawKey) {
    throw new Error("MEDICAL_ENCRYPTION_KEY is not configured.");
  }

  const trimmedKey = rawKey.trim();

  if (/^[0-9a-fA-F]{64}$/.test(trimmedKey)) {
    return;
  }

  if (/^[A-Za-z0-9+/]+={0,2}$/.test(trimmedKey)) {
    const decodedLength = Buffer.from(trimmedKey, "base64").length;

    if (decodedLength === 32) {
      return;
    }
  }

  throw new Error(
    "MEDICAL_ENCRYPTION_KEY must be a 32-byte base64 string or a 64-character hex string.",
  );
}
