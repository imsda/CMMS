import assert from "node:assert/strict";
import test from "node:test";
import { UserRole } from "@prisma/client";

import { createEventFromInput } from "../lib/data/event-admin";
import { prisma } from "../lib/prisma";
import {
  disconnectIntegrationPrisma,
  hasIntegrationDatabase,
  resetIntegrationDatabase,
} from "./integration-helpers";

test("events retain their optional createdBy relation", { skip: !hasIntegrationDatabase }, async () => {
  await resetIntegrationDatabase();

  const admin = await prisma.user.create({
    data: {
      email: "creator@example.org",
      name: "Creator",
      role: UserRole.SUPER_ADMIN,
    },
  });

  await prisma.$transaction(async (tx) => {
    await createEventFromInput(
      tx,
      {
        name: "Creator Linked Event",
        description: "Tests event creator relation",
        startsAt: new Date("2026-04-10T12:00:00.000Z"),
        endsAt: new Date("2026-04-12T18:00:00.000Z"),
        registrationOpensAt: new Date("2026-03-01T00:00:00.000Z"),
        registrationClosesAt: new Date("2026-04-01T00:00:00.000Z"),
        basePrice: 35,
        lateFeePrice: 45,
        lateFeeStartsAt: new Date("2026-03-20T00:00:00.000Z"),
        locationName: "Camp",
        locationAddress: "123 Road",
        dynamicFields: [],
      },
      admin.id,
      "creator-linked-event",
    );
  });

  const event = await prisma.event.findUniqueOrThrow({
    where: {
      slug: "creator-linked-event",
    },
    include: {
      createdBy: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  assert.equal(event.createdByUserId, admin.id);
  assert.equal(event.createdBy?.email, "creator@example.org");
});

test.after(async () => {
  await disconnectIntegrationPrisma();
});
