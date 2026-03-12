import test from "node:test";
import assert from "node:assert/strict";

import { buildStudentPortalData } from "../lib/data/student-portal";

test("linked user sees only explicitly linked student data", () => {
  const portalData = buildStudentPortalData({
    linkedRosterMembers: [
      {
        id: "student-1",
        firstName: "Alice",
        lastName: "Adventurer",
        memberRole: "ADVENTURER",
        clubName: "Central Club",
        clubCode: "CENT",
        rosterYearLabel: "2026",
      },
    ],
    completedRequirements: [
      {
        id: "req-1",
        metadata: { honorCode: "HON-1" },
        completedAt: new Date("2026-01-01T00:00:00.000Z"),
        rosterMemberId: "student-1",
      },
      {
        id: "req-2",
        metadata: { honorCode: "HON-2" },
        completedAt: new Date("2026-01-02T00:00:00.000Z"),
        rosterMemberId: "student-2",
      },
    ],
    upcomingEnrollments: [
      {
        id: "enrollment-1",
        rosterMemberId: "student-1",
        offering: {
          classCatalog: {
            title: "Nature Honor",
          },
          event: {
            name: "Spring Camporee",
            startsAt: new Date("2026-04-01T09:00:00.000Z"),
            endsAt: new Date("2026-04-01T16:00:00.000Z"),
            locationName: "Camp Woods",
          },
        },
      },
      {
        id: "enrollment-2",
        rosterMemberId: "student-2",
        offering: {
          classCatalog: {
            title: "Knots Honor",
          },
          event: {
            name: "Spring Camporee",
            startsAt: new Date("2026-04-01T09:00:00.000Z"),
            endsAt: new Date("2026-04-01T16:00:00.000Z"),
            locationName: "Camp Woods",
          },
        },
      },
    ],
    honorCatalog: [
      {
        code: "HON-1",
        title: "Nature Honor",
      },
      {
        code: "HON-2",
        title: "Knots Honor",
      },
    ],
  });

  assert.equal(portalData.linkedStudents.length, 1);
  assert.equal(portalData.completedHonors.length, 1);
  assert.equal(portalData.completedHonors[0]?.rosterMemberName, "Alice Adventurer");
  assert.equal(portalData.eventClassAssignments.length, 1);
  assert.equal(portalData.eventClassAssignments[0]?.rosterMemberName, "Alice Adventurer");
});

test("multiple explicit student links are supported", () => {
  const portalData = buildStudentPortalData({
    linkedRosterMembers: [
      {
        id: "student-1",
        firstName: "Alice",
        lastName: "Adventurer",
        memberRole: "ADVENTURER",
        clubName: "Central Club",
        clubCode: "CENT",
        rosterYearLabel: "2026",
      },
      {
        id: "student-2",
        firstName: "Ben",
        lastName: "Pathfinder",
        memberRole: "PATHFINDER",
        clubName: "Central Club",
        clubCode: "CENT",
        rosterYearLabel: "2026",
      },
    ],
    completedRequirements: [
      {
        id: "req-1",
        metadata: { honorCode: "HON-1" },
        completedAt: new Date("2026-01-01T00:00:00.000Z"),
        rosterMemberId: "student-1",
      },
      {
        id: "req-2",
        metadata: { honorCode: "HON-2" },
        completedAt: new Date("2026-01-02T00:00:00.000Z"),
        rosterMemberId: "student-2",
      },
    ],
    upcomingEnrollments: [],
    honorCatalog: [
      {
        code: "HON-1",
        title: "Nature Honor",
      },
      {
        code: "HON-2",
        title: "Knots Honor",
      },
    ],
  });

  assert.equal(portalData.linkedStudents.length, 2);
  assert.deepEqual(
    portalData.completedHonors.map((entry) => entry.rosterMemberName).sort(),
    ["Alice Adventurer", "Ben Pathfinder"],
  );
});

test("missing explicit links produce an empty portal view", () => {
  const portalData = buildStudentPortalData({
    linkedRosterMembers: [],
    completedRequirements: [
      {
        id: "req-1",
        metadata: { honorCode: "HON-1" },
        completedAt: new Date("2026-01-01T00:00:00.000Z"),
        rosterMemberId: "student-1",
      },
    ],
    upcomingEnrollments: [],
    honorCatalog: [
      {
        code: "HON-1",
        title: "Nature Honor",
      },
    ],
  });

  assert.equal(portalData.linkedStudents.length, 0);
  assert.equal(portalData.completedHonors.length, 0);
  assert.equal(portalData.eventClassAssignments.length, 0);
});
