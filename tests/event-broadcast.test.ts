import test from "node:test";
import assert from "node:assert/strict";

// Test the broadcast filter logic

type BroadcastFilter = "ALL" | "APPROVED_ONLY" | "PENDING_PAYMENT_ONLY";

const ACTIVE_STATUSES = [
  "SUBMITTED",
  "REVIEWED",
  "NEEDS_CHANGES",
  "APPROVED",
];

function buildBroadcastFilterShape(filter: BroadcastFilter): {
  statusIsApprovedOnly: boolean;
  statusIsActive: boolean;
  requiresPendingPayment: boolean;
} {
  return {
    statusIsApprovedOnly: filter === "APPROVED_ONLY",
    statusIsActive: filter === "ALL" || filter === "PENDING_PAYMENT_ONLY",
    requiresPendingPayment: filter === "PENDING_PAYMENT_ONLY",
  };
}

function parseBroadcastFilter(value: string | null): BroadcastFilter {
  if (value === "APPROVED_ONLY") return "APPROVED_ONLY";
  if (value === "PENDING_PAYMENT_ONLY") return "PENDING_PAYMENT_ONLY";
  return "ALL";
}

test("ALL filter uses active registration statuses without payment filter", () => {
  const shape = buildBroadcastFilterShape("ALL");
  assert.equal(shape.statusIsActive, true);
  assert.equal(shape.statusIsApprovedOnly, false);
  assert.equal(shape.requiresPendingPayment, false);
  assert.ok(ACTIVE_STATUSES.includes("SUBMITTED"));
  assert.ok(ACTIVE_STATUSES.includes("REVIEWED"));
  assert.ok(ACTIVE_STATUSES.includes("NEEDS_CHANGES"));
  assert.ok(ACTIVE_STATUSES.includes("APPROVED"));
  assert.ok(!ACTIVE_STATUSES.includes("DRAFT"));
  assert.ok(!ACTIVE_STATUSES.includes("REJECTED"));
});

test("APPROVED_ONLY filter targets only approved registrations", () => {
  const shape = buildBroadcastFilterShape("APPROVED_ONLY");
  assert.equal(shape.statusIsApprovedOnly, true);
  assert.equal(shape.statusIsActive, false);
  assert.equal(shape.requiresPendingPayment, false);
});

test("PENDING_PAYMENT_ONLY filter targets pending payments across active statuses", () => {
  const shape = buildBroadcastFilterShape("PENDING_PAYMENT_ONLY");
  assert.equal(shape.statusIsActive, true);
  assert.equal(shape.requiresPendingPayment, true);
  assert.equal(shape.statusIsApprovedOnly, false);
});

test("parseBroadcastFilter defaults to ALL for unknown/null values", () => {
  assert.equal(parseBroadcastFilter(null), "ALL");
  assert.equal(parseBroadcastFilter(""), "ALL");
  assert.equal(parseBroadcastFilter("INVALID"), "ALL");
  assert.equal(parseBroadcastFilter("APPROVED_ONLY"), "APPROVED_ONLY");
  assert.equal(parseBroadcastFilter("PENDING_PAYMENT_ONLY"), "PENDING_PAYMENT_ONLY");
});
