import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { MemberRole, PaymentStatus, RegistrationStatus, UserRole } from "@prisma/client";

import { POST } from "../app/api/webhooks/square/route";
import { prisma } from "../lib/prisma";
import {
  disconnectIntegrationPrisma,
  hasIntegrationDatabase,
  resetIntegrationDatabase,
} from "./integration-helpers";

function buildSquareSignature(key: string, url: string, body: string): string {
  return createHmac("sha256", key).update(url + body).digest("base64");
}

function buildWebhookRequest(
  body: object,
  opts: { signatureKey: string; url: string; overrideSignature?: string },
): Request {
  const rawBody = JSON.stringify(body);
  const signature =
    opts.overrideSignature ?? buildSquareSignature(opts.signatureKey, opts.url, rawBody);

  return new Request(opts.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-square-hmacsha256-signature": signature,
      "x-forwarded-for": "192.0.2.1",
    },
    body: rawBody,
  });
}

const WEBHOOK_URL = "https://example.com/api/webhooks/square";
const SIGNATURE_KEY = "integration-test-signature-key";

test(
  "webhook marks registration PAID and stores squarePaymentId",
  { skip: !hasIntegrationDatabase },
  async () => {
    await resetIntegrationDatabase();

    process.env.SQUARE_WEBHOOK_SIGNATURE_KEY = SIGNATURE_KEY;
    process.env.NEXT_PUBLIC_APP_URL = "https://example.com";

    const club = await prisma.club.create({
      data: {
        name: "Northside Club",
        code: "NRTH",
        type: "PATHFINDER",
      },
    });

    const directorUser = await prisma.user.create({
      data: {
        email: "director@northside.org",
        name: "Director North",
        role: UserRole.CLUB_DIRECTOR,
        memberships: {
          create: { clubId: club.id, isPrimary: true },
        },
      },
    });

    const rosterYear = await prisma.clubRosterYear.create({
      data: {
        clubId: club.id,
        yearLabel: "2026",
        startsOn: new Date("2026-01-01"),
        endsOn: new Date("2026-12-31"),
        isActive: true,
      },
    });

    const member = await prisma.rosterMember.create({
      data: {
        clubRosterYearId: rosterYear.id,
        firstName: "Sam",
        lastName: "Scout",
        memberRole: MemberRole.PATHFINDER,
      },
    });

    const event = await prisma.event.create({
      data: {
        name: "Spring Camporee",
        slug: "spring-camporee-pay-test",
        startsAt: new Date("2026-04-10"),
        endsAt: new Date("2026-04-12"),
        registrationOpensAt: new Date("2026-03-01"),
        registrationClosesAt: new Date("2026-04-01"),
        basePrice: 25,
        lateFeePrice: 30,
        lateFeeStartsAt: new Date("2026-03-20"),
      },
    });

    const squareOrderId = "ORDER_WEBHOOK_TEST_001";
    const squarePaymentId = "PAYMENT_WEBHOOK_TEST_001";

    const registration = await prisma.eventRegistration.create({
      data: {
        eventId: event.id,
        clubId: club.id,
        registrationCode: "REG-PAY-TEST",
        status: RegistrationStatus.SUBMITTED,
        totalDue: 25,
        paymentStatus: PaymentStatus.PENDING,
        squareOrderId,
        attendees: { create: { rosterMemberId: member.id } },
      },
    });

    const webhookPayload = {
      type: "payment.completed",
      data: {
        object: {
          payment: {
            id: squarePaymentId,
            order_id: squareOrderId,
            status: "COMPLETED",
          },
        },
      },
    };

    const request = buildWebhookRequest(webhookPayload, {
      signatureKey: SIGNATURE_KEY,
      url: WEBHOOK_URL,
    });

    const response = await POST(request);
    assert.equal(response.status, 200);
    const body = (await response.json()) as { ok?: boolean };
    assert.equal(body.ok, true);

    const updated = await prisma.eventRegistration.findUniqueOrThrow({
      where: { id: registration.id },
    });

    assert.equal(updated.paymentStatus, PaymentStatus.PAID);
    assert.equal(updated.squarePaymentId, squarePaymentId);

    // Cleanup env vars set during this test
    delete process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
    delete process.env.NEXT_PUBLIC_APP_URL;

    // directorUser referenced to avoid unused-variable lint; suppress by reading id
    void directorUser.id;
  },
);

test(
  "webhook rejects requests with an invalid signature",
  { skip: !hasIntegrationDatabase },
  async () => {
    process.env.SQUARE_WEBHOOK_SIGNATURE_KEY = SIGNATURE_KEY;
    process.env.NEXT_PUBLIC_APP_URL = "https://example.com";

    const request = buildWebhookRequest(
      { type: "payment.completed" },
      {
        signatureKey: SIGNATURE_KEY,
        url: WEBHOOK_URL,
        overrideSignature: "dGhpc2lzd3Jvbmc=", // wrong but valid base64
      },
    );

    const response = await POST(request);
    assert.equal(response.status, 401);

    delete process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
    delete process.env.NEXT_PUBLIC_APP_URL;
  },
);

test(
  "webhook returns 200 for non-payment.completed events without processing",
  { skip: !hasIntegrationDatabase },
  async () => {
    process.env.SQUARE_WEBHOOK_SIGNATURE_KEY = SIGNATURE_KEY;
    process.env.NEXT_PUBLIC_APP_URL = "https://example.com";

    const request = buildWebhookRequest(
      { type: "payment.created" },
      { signatureKey: SIGNATURE_KEY, url: WEBHOOK_URL },
    );

    const response = await POST(request);
    assert.equal(response.status, 200);
    const body = (await response.json()) as { ok?: boolean };
    assert.equal(body.ok, true);

    delete process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
    delete process.env.NEXT_PUBLIC_APP_URL;
  },
);

test(
  "webhook is idempotent: second call for same payment does not re-process",
  { skip: !hasIntegrationDatabase },
  async () => {
    await resetIntegrationDatabase();

    process.env.SQUARE_WEBHOOK_SIGNATURE_KEY = SIGNATURE_KEY;
    process.env.NEXT_PUBLIC_APP_URL = "https://example.com";

    const club = await prisma.club.create({
      data: { name: "Southside Club", code: "STHS", type: "PATHFINDER" },
    });

    const rosterYear = await prisma.clubRosterYear.create({
      data: {
        clubId: club.id,
        yearLabel: "2026",
        startsOn: new Date("2026-01-01"),
        endsOn: new Date("2026-12-31"),
        isActive: true,
      },
    });

    const member = await prisma.rosterMember.create({
      data: {
        clubRosterYearId: rosterYear.id,
        firstName: "Jo",
        lastName: "Scout",
        memberRole: MemberRole.PATHFINDER,
      },
    });

    const event = await prisma.event.create({
      data: {
        name: "Fall Retreat",
        slug: "fall-retreat-idempotent",
        startsAt: new Date("2026-10-01"),
        endsAt: new Date("2026-10-03"),
        registrationOpensAt: new Date("2026-09-01"),
        registrationClosesAt: new Date("2026-09-28"),
        basePrice: 20,
        lateFeePrice: 25,
        lateFeeStartsAt: new Date("2026-09-20"),
      },
    });

    const squareOrderId = "ORDER_IDEMPOTENT_002";

    await prisma.eventRegistration.create({
      data: {
        eventId: event.id,
        clubId: club.id,
        registrationCode: "REG-IDEM-002",
        status: RegistrationStatus.SUBMITTED,
        totalDue: 20,
        paymentStatus: PaymentStatus.PAID,
        squareOrderId,
        squarePaymentId: "PAYMENT_ALREADY_STORED",
        attendees: { create: { rosterMemberId: member.id } },
      },
    });

    const payload = {
      type: "payment.completed",
      data: {
        object: {
          payment: {
            id: "PAYMENT_DUPLICATE_CALL",
            order_id: squareOrderId,
            status: "COMPLETED",
          },
        },
      },
    };

    const request = buildWebhookRequest(payload, {
      signatureKey: SIGNATURE_KEY,
      url: WEBHOOK_URL,
    });

    const response = await POST(request);
    assert.equal(response.status, 200);

    // Verify squarePaymentId was NOT overwritten
    const updated = await prisma.eventRegistration.findFirstOrThrow({
      where: { squareOrderId },
    });
    assert.equal(updated.squarePaymentId, "PAYMENT_ALREADY_STORED");

    delete process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
    delete process.env.NEXT_PUBLIC_APP_URL;
  },
);

test.after(async () => {
  await disconnectIntegrationPrisma();
});
