import test from "node:test";
import assert from "node:assert/strict";

import {
  decryptMedicalDate,
  decryptMedicalFields,
  decryptStoredMedicalText,
  prepareMedicalFieldsForWrite,
} from "../lib/medical-data";

const VALID_TEST_KEY = "12345678901234567890123456789012";

test("medical write helper encrypts sensitive fields and moves tetanus date to encrypted storage", () => {
  process.env.MEDICAL_ENCRYPTION_KEY = Buffer.from(VALID_TEST_KEY).toString("base64");

  const output = prepareMedicalFieldsForWrite({
    medicalFlags: "Peanut allergy",
    dietaryRestrictions: "Vegetarian",
    insuranceCompany: "Acme Health",
    insurancePolicyNumber: "POL-123",
    lastTetanusDate: new Date("2025-01-10T00:00:00.000Z"),
  });

  assert.notEqual(output.medicalFlags, "Peanut allergy");
  assert.notEqual(output.insuranceCompany, "Acme Health");
  assert.equal(output.lastTetanusDate, null);
  assert.equal(typeof output.lastTetanusDateEncrypted, "string");
});

test("medical read helper decrypts encrypted values and preserves plaintext fallback during backfill", () => {
  process.env.MEDICAL_ENCRYPTION_KEY = Buffer.from(VALID_TEST_KEY).toString("base64");

  const encrypted = prepareMedicalFieldsForWrite({
    medicalFlags: "Asthma",
    dietaryRestrictions: "None",
    insuranceCompany: "Acme",
    insurancePolicyNumber: "ABC",
    lastTetanusDate: new Date("2024-03-05T00:00:00.000Z"),
  });

  const decrypted = decryptMedicalFields({
    medicalFlags: encrypted.medicalFlags,
    dietaryRestrictions: encrypted.dietaryRestrictions,
    insuranceCompany: encrypted.insuranceCompany,
    insurancePolicyNumber: encrypted.insurancePolicyNumber,
    lastTetanusDate: null,
    lastTetanusDateEncrypted: encrypted.lastTetanusDateEncrypted,
  });

  assert.equal(decrypted.medicalFlags, "Asthma");
  assert.equal(decrypted.dietaryRestrictions, "None");
  assert.equal(decrypted.insuranceCompany, "Acme");
  assert.equal(decrypted.insurancePolicyNumber, "ABC");
  assert.equal(decrypted.lastTetanusDate?.toISOString(), "2024-03-05T00:00:00.000Z");
  assert.equal(decryptStoredMedicalText("legacy plaintext"), "legacy plaintext");
  assert.equal(
    decryptMedicalDate(null, new Date("2023-08-01T00:00:00.000Z"))?.toISOString(),
    "2023-08-01T00:00:00.000Z",
  );
});
