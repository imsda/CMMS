import test from "node:test";
import assert from "node:assert/strict";
import { ClassType, MemberRole } from "@prisma/client";

import { enrollAttendeeInClassForClub } from "../app/actions/enrollment-actions";
import { updateClassAttendanceForOffering } from "../app/actions/teacher-actions";
import { prisma } from "../lib/prisma";
import {
  disconnectIntegrationPrisma,
  hasIntegrationDatabase,
  resetIntegrationDatabase,
} from "./integration-helpers";

test("class enrollment and attendance stay separate from event arrival check-in", { skip: !hasIntegrationDatabase }, async () => {
  await resetIntegrationDatabase();

  const club = await prisma.club.create({
    data: {
      name: "Central Club",
      code: "CENT",
      type: "PATHFINDER",
    },
  });

  const teacher = await prisma.user.create({
    data: {
      email: "teacher@example.org",
      name: "Teacher",
      role: "STAFF_TEACHER",
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
      name: "Camporee",
      slug: "camporee-enroll",
      startsAt: new Date("2026-04-10T12:00:00.000Z"),
      endsAt: new Date("2026-04-12T18:00:00.000Z"),
      registrationOpensAt: new Date("2026-03-01T00:00:00.000Z"),
      registrationClosesAt: new Date("2026-04-01T23:59:59.000Z"),
      basePrice: 25,
      lateFeePrice: 30,
      lateFeeStartsAt: new Date("2026-03-20T00:00:00.000Z"),
    },
  });

  const registration = await prisma.eventRegistration.create({
    data: {
      eventId: event.id,
      clubId: club.id,
      registrationCode: "REG-ENROLL",
      status: "SUBMITTED",
      totalDue: 25,
      paymentStatus: "PENDING",
      attendees: {
        create: {
          rosterMemberId: member.id,
        },
      },
    },
    include: {
      attendees: true,
    },
  });

  const catalog = await prisma.classCatalog.create({
    data: {
      title: "Nature Honor",
      code: "HON-NATURE",
      classType: ClassType.HONOR,
    },
  });

  const offering = await prisma.eventClassOffering.create({
    data: {
      eventId: event.id,
      classCatalogId: catalog.id,
      teacherUserId: teacher.id,
      capacity: 5,
    },
  });

  await enrollAttendeeInClassForClub({
    clubId: club.id,
    eventId: event.id,
    rosterMemberId: member.id,
    eventClassOfferingId: offering.id,
  });

  await updateClassAttendanceForOffering({
    offeringId: offering.id,
    rosterMemberId: member.id,
    attended: true,
  });

  const enrollment = await prisma.classEnrollment.findUniqueOrThrow({
    where: {
      eventClassOfferingId_rosterMemberId: {
        eventClassOfferingId: offering.id,
        rosterMemberId: member.id,
      },
    },
  });

  const refreshedAttendee = await prisma.registrationAttendee.findUniqueOrThrow({
    where: {
      eventRegistrationId_rosterMemberId: {
        eventRegistrationId: registration.id,
        rosterMemberId: member.id,
      },
    },
  });

  assert.ok(enrollment.attendedAt instanceof Date);
  assert.equal(refreshedAttendee.checkedInAt, null);
});

test.after(async () => {
  await disconnectIntegrationPrisma();
});
