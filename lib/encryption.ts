import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;

function getEncryptionKey() {
  const rawKey = process.env.MEDICAL_ENCRYPTION_KEY;

  if (!rawKey) {
    throw new Error("MEDICAL_ENCRYPTION_KEY is not configured.");
  }

  const trimmedKey = rawKey.trim();

  if (/^[0-9a-fA-F]{64}$/.test(trimmedKey)) {
    return Buffer.from(trimmedKey, "hex");
  }

  if (/^[A-Za-z0-9+/]+={0,2}$/.test(trimmedKey)) {
    const base64Buffer = Buffer.from(trimmedKey, "base64");

    if (base64Buffer.length === 32) {
      return base64Buffer;
    }
  }

  throw new Error(
    "MEDICAL_ENCRYPTION_KEY must be a 32-byte base64 string or a 64-character hex string.",
  );
}

export function encryptMedicalText(plainText: string | null | undefined) {
  if (!plainText) {
    return null;
  }

  const value = plainText.trim();

  if (value.length === 0) {
    return null;
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptMedicalText(payload: string | null | undefined) {
  if (!payload) {
    return null;
  }

  const [ivBase64, authTagBase64, encryptedBase64] = payload.split(":");

  if (!ivBase64 || !authTagBase64 || !encryptedBase64) {
    throw new Error("Invalid encrypted payload format.");
  }

  const iv = Buffer.from(ivBase64, "base64");
  const authTag = Buffer.from(authTagBase64, "base64");
  const encrypted = Buffer.from(encryptedBase64, "base64");
  const key = getEncryptionKey();

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}
