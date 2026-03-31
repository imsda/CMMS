import test from "node:test";
import assert from "node:assert/strict";
import { RegistrationStatus, UserRole } from "@prisma/client";

import { prisma } from "../lib/prisma";
import {
  disconnectIntegrationPrisma,
  hasIntegrationDatabase,
  resetIntegrationDatabase,
} from "./integration-helpers";

test("campsite assignment can be saved and cleared on an EventRegistration", { skip: !hasIntegrationDatabase }, async () => {
  await resetIntegrationDatabase();

  const event = await prisma.event.create({
    data: {
      name: "Spring Camporee",
      slug: "spring-camporee-assignment",
      startsAt: new Date("2026-04-10T12:00:00.000Z"),
      endsAt: new Date("2026-04-12T18:00:00.000Z"),
      registrationOpensAt: new Date("2026-03-01T00:00:00.000Z"),
      registrationClosesAt: new Date("2026-04-01T23:59:59.000Z"),
      basePrice: 25,
      lateFeePrice: 30,
      lateFeeStartsAt: new Date("2026-03-20T00:00:00.000Z"),
    },
  });

  const club = await prisma.club.create({
    data: {
      name: "Central Club",
      code: "CENT-CA",
      type: "PATHFINDER",
    },
  });

  const registration = await prisma.eventRegistration.create({
    data: {
      eventId: event.id,
      clubId: club.id,
      registrationCode: "REG-CA-001",
      status: RegistrationStatus.SUBMITTED,
      totalDue: 50,
      paymentStatus: "PENDING",
    },
  });

  // Initially no assignment
  assert.equal(registration.campsiteAssignment, null);

  // Save an assignment
  const updated = await prisma.eventRegistration.update({
    where: { id: registration.id },
    data: { campsiteAssignment: "A-12" },
  });
  assert.equal(updated.campsiteAssignment, "A-12");

  // Verify it persists on read
  const fetched = await prisma.eventRegistration.findUnique({
    where: { id: registration.id },
    select: { campsiteAssignment: true },
  });
  assert.equal(fetched?.campsiteAssignment, "A-12");

  // Clear the assignment
  const cleared = await prisma.eventRegistration.update({
    where: { id: registration.id },
    data: { campsiteAssignment: null },
  });
  assert.equal(cleared.campsiteAssignment, null);
});

test("campsite assignment stores trimmed label and allows blank to clear", { skip: !hasIntegrationDatabase }, async () => {
  await resetIntegrationDatabase();

  const event = await prisma.event.create({
    data: {
      name: "Fall Camporee",
      slug: "fall-camporee-assignment",
      startsAt: new Date("2026-09-10T12:00:00.000Z"),
      endsAt: new Date("2026-09-12T18:00:00.000Z"),
      registrationOpensAt: new Date("2026-08-01T00:00:00.000Z"),
      registrationClosesAt: new Date("2026-09-01T23:59:59.000Z"),
      basePrice: 25,
      lateFeePrice: 30,
      lateFeeStartsAt: new Date("2026-08-20T00:00:00.000Z"),
    },
  });

  const club = await prisma.club.create({
    data: {
      name: "East Side Club",
      code: "EAST-CA",
      type: "PATHFINDER",
    },
  });

  const registration = await prisma.eventRegistration.create({
    data: {
      eventId: event.id,
      clubId: club.id,
      registrationCode: "REG-EAST-001",
      status: RegistrationStatus.APPROVED,
      totalDue: 50,
      paymentStatus: "PENDING",
    },
  });

  // Simulate the action logic: trim and treat empty as null
  const rawLabel = "  B-7  ";
  const label = rawLabel.trim();
  await prisma.eventRegistration.update({
    where: { id: registration.id },
    data: { campsiteAssignment: label.length > 0 ? label : null },
  });

  const result = await prisma.eventRegistration.findUnique({
    where: { id: registration.id },
    select: { campsiteAssignment: true },
  });
  assert.equal(result?.campsiteAssignment, "B-7");

  // Empty string clears the assignment
  const emptyLabel = "   ";
  const trimmed = emptyLabel.trim();
  await prisma.eventRegistration.update({
    where: { id: registration.id },
    data: { campsiteAssignment: trimmed.length > 0 ? trimmed : null },
  });

  const cleared = await prisma.eventRegistration.findUnique({
    where: { id: registration.id },
    select: { campsiteAssignment: true },
  });
  assert.equal(cleared?.campsiteAssignment, null);
});

test("campsite assignment does not affect other EventRegistration fields", { skip: !hasIntegrationDatabase }, async () => {
  await resetIntegrationDatabase();

  await prisma.user.create({
    data: {
      email: "admin@test.org",
      name: "Admin",
      role: UserRole.SUPER_ADMIN,
    },
  });

  const event = await prisma.event.create({
    data: {
      name: "Winter Camporee",
      slug: "winter-camporee-assignment",
      startsAt: new Date("2026-12-10T12:00:00.000Z"),
      endsAt: new Date("2026-12-12T18:00:00.000Z"),
      registrationOpensAt: new Date("2026-11-01T00:00:00.000Z"),
      registrationClosesAt: new Date("2026-12-01T23:59:59.000Z"),
      basePrice: 30,
      lateFeePrice: 35,
      lateFeeStartsAt: new Date("2026-11-20T00:00:00.000Z"),
    },
  });

  const club = await prisma.club.create({
    data: {
      name: "West Club",
      code: "WEST-CA",
      type: "PATHFINDER",
    },
  });

  const registration = await prisma.eventRegistration.create({
    data: {
      eventId: event.id,
      clubId: club.id,
      registrationCode: "REG-WEST-001",
      status: RegistrationStatus.APPROVED,
      reviewerNotes: "Looks good",
      totalDue: 75,
      amountPaid: 75,
      paymentStatus: "PAID",
    },
  });

  await prisma.eventRegistration.update({
    where: { id: registration.id },
    data: { campsiteAssignment: "C-3" },
  });

  const result = await prisma.eventRegistration.findUnique({
    where: { id: registration.id },
  });

  assert.equal(result?.campsiteAssignment, "C-3");
  assert.equal(result?.reviewerNotes, "Looks good");
  assert.equal(result?.amountPaid, 75);
  assert.equal(result?.paymentStatus, "PAID");
  assert.equal(result?.status, RegistrationStatus.APPROVED);
});

test.after(async () => {
  await disconnectIntegrationPrisma();
});
