import test from "node:test";
import assert from "node:assert/strict";
import { FormFieldScope, FormFieldType, MemberRole, RegistrationStatus } from "@prisma/client";

import { approveRegistrationForCheckIn } from "../app/actions/checkin-actions";
import { prisma } from "../lib/prisma";
import {
  disconnectIntegrationPrisma,
  hasIntegrationDatabase,
  resetIntegrationDatabase,
} from "./integration-helpers";

test("check-in approval blocks incomplete submitted registrations and approves complete ones", { skip: !hasIntegrationDatabase }, async () => {
  await resetIntegrationDatabase();

  const club = await prisma.club.create({
    data: {
      name: "Central Club",
      code: "CENT",
      type: "PATHFINDER",
    },
  });

  const rosterYear = await prisma.clubRosterYear.create({
    data: {
      clubId: club.id,
      yearLabel: "2026",
      startsOn: new Date("2026-01-01T00:00:00.000Z"),
      endsOn: new Date("2026-12-31T23:59:59.000Z"),
      isActive: true,
    },
  });

  const member = await prisma.rosterMember.create({
    data: {
      clubRosterYearId: rosterYear.id,
      firstName: "Alice",
      lastName: "Adventurer",
      memberRole: MemberRole.PATHFINDER,
      photoReleaseConsent: true,
      medicalTreatmentConsent: true,
      membershipAgreementConsent: true,
    },
  });

  const event = await prisma.event.create({
    data: {
      name: "Spring Camporee",
      slug: "spring-camporee-checkin",
      startsAt: new Date("2026-04-10T12:00:00.000Z"),
      endsAt: new Date("2026-04-12T18:00:00.000Z"),
      registrationOpensAt: new Date("2026-03-01T00:00:00.000Z"),
      registrationClosesAt: new Date("2026-04-01T23:59:59.000Z"),
      basePrice: 25,
      lateFeePrice: 30,
      lateFeeStartsAt: new Date("2026-03-20T00:00:00.000Z"),
      dynamicFields: {
        create: [
          {
            key: "club_note",
            label: "Club Note",
            type: FormFieldType.SHORT_TEXT,
            fieldScope: FormFieldScope.GLOBAL,
            isRequired: true,
            sortOrder: 0,
          },
          {
            key: "shirt_size",
            label: "Shirt Size",
            type: FormFieldType.SHORT_TEXT,
            fieldScope: FormFieldScope.ATTENDEE,
            isRequired: true,
            sortOrder: 1,
          },
        ],
      },
    },
    include: {
      dynamicFields: true,
    },
  });

  const registration = await prisma.eventRegistration.create({
    data: {
      eventId: event.id,
      clubId: club.id,
      registrationCode: "REG-CHECKIN",
      status: RegistrationStatus.SUBMITTED,
      submittedAt: new Date("2026-03-10T12:00:00.000Z"),
      totalDue: 25,
      paymentStatus: "PENDING",
      attendees: {
        create: {
          rosterMemberId: member.id,
        },
      },
      formResponses: {
        create: {
          eventFormFieldId: event.dynamicFields[0]!.id,
          attendeeId: null,
          value: "Ready",
        },
      },
    },
  });

  await assert.rejects(() => approveRegistrationForCheckIn(event.id, registration.id));

  await prisma.eventFormResponse.create({
    data: {
      eventRegistrationId: registration.id,
      eventFormFieldId: event.dynamicFields[1]!.id,
      attendeeId: member.id,
      value: "M",
    },
  });

  await approveRegistrationForCheckIn(event.id, registration.id);

  const approved = await prisma.eventRegistration.findUniqueOrThrow({
    where: {
      id: registration.id,
    },
    include: {
      attendees: true,
    },
  });

  assert.equal(approved.status, RegistrationStatus.APPROVED);
  assert.ok(approved.approvedAt instanceof Date);
  assert.ok(approved.attendees[0]?.checkedInAt instanceof Date);
});

test.after(async () => {
  await disconnectIntegrationPrisma();
});
