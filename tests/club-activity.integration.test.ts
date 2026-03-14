import test from "node:test";
import assert from "node:assert/strict";
import { MemberRole } from "@prisma/client";

import { getClubActivityMonthSnapshot } from "../lib/data/club-activity";
import { prisma } from "../lib/prisma";
import {
  disconnectIntegrationPrisma,
  hasIntegrationDatabase,
  resetIntegrationDatabase,
} from "./integration-helpers";

test("club activity month snapshot aggregates activity logs and preserves existing monthly reports", { skip: !hasIntegrationDatabase }, async () => {
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

  await prisma.rosterMember.create({
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

  await prisma.clubActivity.createMany({
    data: [
      {
        clubRosterYearId: rosterYear.id,
        activityDate: new Date("2026-04-03T00:00:00.000Z"),
        title: "Regular Meeting",
        pathfinderAttendance: 16,
        staffAttendance: 4,
        uniformCompliance: 85,
      },
      {
        clubRosterYearId: rosterYear.id,
        activityDate: new Date("2026-04-10T00:00:00.000Z"),
        title: "Drill Practice",
        pathfinderAttendance: 20,
        staffAttendance: 5,
        uniformCompliance: 95,
      },
    ],
  });

  const monthStart = new Date("2026-04-01T00:00:00.000Z");
  const initialSnapshot = await getClubActivityMonthSnapshot(club.id, monthStart);

  assert.equal(initialSnapshot.activities.length, 2);
  assert.equal(initialSnapshot.autoFill.meetingOutingCount, 2);
  assert.equal(initialSnapshot.autoFill.averagePathfinderAttendance, 18);
  assert.equal(initialSnapshot.autoFill.averageStaffAttendance, 5);
  assert.equal(initialSnapshot.autoFill.uniformCompliance, 90);
  assert.equal(initialSnapshot.formValues.meetingOutingCount, 2);

  await prisma.monthlyReport.create({
    data: {
      clubId: club.id,
      clubRosterYearId: rosterYear.id,
      reportMonth: monthStart,
      meetingOutingCount: 4,
      averageAttendance: 27,
      averagePathfinderAttendance: 21,
      averageTltAttendance: 0,
      averageStaffAttendance: 6,
      pathfinderCount: 21,
      tltCount: 0,
      staffCount: 6,
      uniformCompliance: 93,
      totalScore: 150,
      status: "SUBMITTED",
      submittedByName: "Director Jones",
      submittedAt: new Date("2026-04-30T00:00:00.000Z"),
    },
  });

  const reportSnapshot = await getClubActivityMonthSnapshot(club.id, monthStart);

  assert.equal(reportSnapshot.existingReport?.meetingOutingCount, 4);
  assert.deepEqual(reportSnapshot.formValues, {
    meetingDay: "",
    meetingTime: "",
    meetingLocation: "",
    averageAttendance: 27,
    averagePathfinderAttendance: 21,
    averageTltAttendance: 0,
    averageStaffAttendance: 6,
    pathfinderCount: 21,
    tltCount: 0,
    staffCount: 6,
    staffMeetingHeld: false,
    meetingOutingCount: 4,
    devotionsEmphasis: "",
    exercisePromotion: "",
    outreachActivities: "",
    guestHelperCount: 0,
    uniformCompliance: 93,
    uniformNotes: "",
    honorWorkSummary: "",
    honorParticipantCount: 0,
    bonusNotes: "",
    submittedByName: "Director Jones",
  });
});

test.after(async () => {
  await disconnectIntegrationPrisma();
});
