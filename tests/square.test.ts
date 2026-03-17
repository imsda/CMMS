import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import {
  getSquareBaseUrl,
  getSquareConfig,
  verifySquareWebhookSignature,
} from "../lib/payments/square";

// ---------------------------------------------------------------------------
// getSquareConfig
// ---------------------------------------------------------------------------

test("getSquareConfig returns null when SQUARE_ACCESS_TOKEN is missing", () => {
  const original = {
    SQUARE_ACCESS_TOKEN: process.env.SQUARE_ACCESS_TOKEN,
    SQUARE_LOCATION_ID: process.env.SQUARE_LOCATION_ID,
  };
  delete process.env.SQUARE_ACCESS_TOKEN;
  process.env.SQUARE_LOCATION_ID = "LOC123";

  const result = getSquareConfig();
  assert.equal(result, null);

  process.env.SQUARE_ACCESS_TOKEN = original.SQUARE_ACCESS_TOKEN;
  process.env.SQUARE_LOCATION_ID = original.SQUARE_LOCATION_ID;
});

test("getSquareConfig returns null when SQUARE_LOCATION_ID is missing", () => {
  const original = {
    SQUARE_ACCESS_TOKEN: process.env.SQUARE_ACCESS_TOKEN,
    SQUARE_LOCATION_ID: process.env.SQUARE_LOCATION_ID,
  };
  process.env.SQUARE_ACCESS_TOKEN = "tok_test";
  delete process.env.SQUARE_LOCATION_ID;

  const result = getSquareConfig();
  assert.equal(result, null);

  process.env.SQUARE_ACCESS_TOKEN = original.SQUARE_ACCESS_TOKEN;
  process.env.SQUARE_LOCATION_ID = original.SQUARE_LOCATION_ID;
});

test("getSquareConfig defaults to sandbox when SQUARE_ENVIRONMENT is not set", () => {
  const original = {
    SQUARE_ACCESS_TOKEN: process.env.SQUARE_ACCESS_TOKEN,
    SQUARE_LOCATION_ID: process.env.SQUARE_LOCATION_ID,
    SQUARE_ENVIRONMENT: process.env.SQUARE_ENVIRONMENT,
  };
  process.env.SQUARE_ACCESS_TOKEN = "tok_test";
  process.env.SQUARE_LOCATION_ID = "LOC123";
  delete process.env.SQUARE_ENVIRONMENT;

  const result = getSquareConfig();
  assert.ok(result !== null);
  assert.equal(result!.environment, "sandbox");

  process.env.SQUARE_ACCESS_TOKEN = original.SQUARE_ACCESS_TOKEN;
  process.env.SQUARE_LOCATION_ID = original.SQUARE_LOCATION_ID;
  process.env.SQUARE_ENVIRONMENT = original.SQUARE_ENVIRONMENT;
});

test("getSquareConfig returns production environment when configured", () => {
  const original = {
    SQUARE_ACCESS_TOKEN: process.env.SQUARE_ACCESS_TOKEN,
    SQUARE_LOCATION_ID: process.env.SQUARE_LOCATION_ID,
    SQUARE_ENVIRONMENT: process.env.SQUARE_ENVIRONMENT,
  };
  process.env.SQUARE_ACCESS_TOKEN = "tok_prod";
  process.env.SQUARE_LOCATION_ID = "LOC_PROD";
  process.env.SQUARE_ENVIRONMENT = "production";

  const result = getSquareConfig();
  assert.ok(result !== null);
  assert.equal(result!.environment, "production");
  assert.equal(result!.accessToken, "tok_prod");
  assert.equal(result!.locationId, "LOC_PROD");

  process.env.SQUARE_ACCESS_TOKEN = original.SQUARE_ACCESS_TOKEN;
  process.env.SQUARE_LOCATION_ID = original.SQUARE_LOCATION_ID;
  process.env.SQUARE_ENVIRONMENT = original.SQUARE_ENVIRONMENT;
});

// ---------------------------------------------------------------------------
// getSquareBaseUrl
// ---------------------------------------------------------------------------

test("getSquareBaseUrl returns production URL for production environment", () => {
  assert.equal(
    getSquareBaseUrl("production"),
    "https://connect.squareup.com",
  );
});

test("getSquareBaseUrl returns sandbox URL for sandbox environment", () => {
  assert.equal(
    getSquareBaseUrl("sandbox"),
    "https://connect.squareupsandbox.com",
  );
});

// ---------------------------------------------------------------------------
// verifySquareWebhookSignature
// ---------------------------------------------------------------------------

function buildSignature(key: string, url: string, body: string): string {
  return createHmac("sha256", key).update(url + body).digest("base64");
}

test("verifySquareWebhookSignature accepts a valid signature", () => {
  const signatureKey = "test-signature-key";
  const notificationUrl = "https://example.com/api/webhooks/square";
  const rawBody = JSON.stringify({ type: "payment.completed" });
  const receivedSignature = buildSignature(signatureKey, notificationUrl, rawBody);

  const result = verifySquareWebhookSignature({
    signatureKey,
    notificationUrl,
    rawBody,
    receivedSignature,
  });

  assert.equal(result, true);
});

test("verifySquareWebhookSignature rejects a tampered body", () => {
  const signatureKey = "test-signature-key";
  const notificationUrl = "https://example.com/api/webhooks/square";
  const originalBody = JSON.stringify({ type: "payment.completed" });
  const receivedSignature = buildSignature(signatureKey, notificationUrl, originalBody);

  const result = verifySquareWebhookSignature({
    signatureKey,
    notificationUrl,
    rawBody: JSON.stringify({ type: "payment.completed", injected: true }),
    receivedSignature,
  });

  assert.equal(result, false);
});

test("verifySquareWebhookSignature rejects a wrong signature key", () => {
  const notificationUrl = "https://example.com/api/webhooks/square";
  const rawBody = JSON.stringify({ type: "payment.completed" });
  const receivedSignature = buildSignature("correct-key", notificationUrl, rawBody);

  const result = verifySquareWebhookSignature({
    signatureKey: "wrong-key",
    notificationUrl,
    rawBody,
    receivedSignature,
  });

  assert.equal(result, false);
});

test("verifySquareWebhookSignature rejects a wrong notification URL", () => {
  const signatureKey = "test-key";
  const rawBody = JSON.stringify({ type: "payment.completed" });
  const receivedSignature = buildSignature(
    signatureKey,
    "https://correct.com/api/webhooks/square",
    rawBody,
  );

  const result = verifySquareWebhookSignature({
    signatureKey,
    notificationUrl: "https://attacker.com/api/webhooks/square",
    rawBody,
    receivedSignature,
  });

  assert.equal(result, false);
});

test("verifySquareWebhookSignature returns false for malformed base64 signature", () => {
  const result = verifySquareWebhookSignature({
    signatureKey: "key",
    notificationUrl: "https://example.com",
    rawBody: "body",
    receivedSignature: "not-valid-base64!!!",
  });

  assert.equal(result, false);
});
