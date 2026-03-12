import { assertMedicalEncryptionConfigured, decryptMedicalText, encryptMedicalText } from "./encryption";

const ENCRYPTED_PAYLOAD_PATTERN =
  /^[A-Za-z0-9+/]+={0,2}:[A-Za-z0-9+/]+={0,2}:[A-Za-z0-9+/]+={0,2}$/;

export type MedicalFieldCarrier = {
  medicalFlags?: string | null;
  dietaryRestrictions?: string | null;
  insuranceCompany?: string | null;
  insurancePolicyNumber?: string | null;
  lastTetanusDate?: Date | null;
  lastTetanusDateEncrypted?: string | null;
};

type PlainMedicalFields = {
  medicalFlags: string | null;
  dietaryRestrictions: string | null;
  insuranceCompany: string | null;
  insurancePolicyNumber: string | null;
  lastTetanusDate: Date | null;
};

function normalizeNullableText(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isEncryptedMedicalValue(value: string | null | undefined) {
  return typeof value === "string" && ENCRYPTED_PAYLOAD_PATTERN.test(value);
}

export function decryptStoredMedicalText(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  if (!isEncryptedMedicalValue(value)) {
    return normalizeNullableText(value);
  }

  return normalizeNullableText(decryptMedicalText(value));
}

export function encryptMedicalDate(value: Date | null | undefined) {
  if (!value) {
    return null;
  }

  return encryptMedicalText(value.toISOString());
}

export function decryptMedicalDate(
  encryptedValue: string | null | undefined,
  legacyValue: Date | null | undefined,
) {
  if (encryptedValue) {
    const decrypted = decryptStoredMedicalText(encryptedValue);

    if (!decrypted) {
      return null;
    }

    const parsed = new Date(decrypted);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error("Stored encrypted tetanus date is invalid.");
    }

    return parsed;
  }

  return legacyValue ?? null;
}

export function prepareMedicalFieldsForWrite(fields: PlainMedicalFields) {
  return {
    medicalFlags: encryptMedicalText(fields.medicalFlags),
    dietaryRestrictions: encryptMedicalText(fields.dietaryRestrictions),
    insuranceCompany: encryptMedicalText(fields.insuranceCompany),
    insurancePolicyNumber: encryptMedicalText(fields.insurancePolicyNumber),
    lastTetanusDate: null,
    lastTetanusDateEncrypted: encryptMedicalDate(fields.lastTetanusDate),
  };
}

export function decryptMedicalFields<T extends MedicalFieldCarrier>(record: T) {
  const decryptedRecord = {
    ...record,
    medicalFlags: decryptStoredMedicalText(record.medicalFlags ?? null),
    dietaryRestrictions: decryptStoredMedicalText(record.dietaryRestrictions ?? null),
    insuranceCompany: decryptStoredMedicalText(record.insuranceCompany ?? null),
    insurancePolicyNumber: decryptStoredMedicalText(record.insurancePolicyNumber ?? null),
    lastTetanusDate: decryptMedicalDate(record.lastTetanusDateEncrypted, record.lastTetanusDate ?? null),
  };

  delete (decryptedRecord as T & { lastTetanusDateEncrypted?: string | null }).lastTetanusDateEncrypted;

  return decryptedRecord as Omit<T, "lastTetanusDateEncrypted"> & PlainMedicalFields;
}

export function validateMedicalEncryptionConfiguration() {
  assertMedicalEncryptionConfigured();
}
