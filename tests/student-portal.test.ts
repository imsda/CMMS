import test from "node:test";
import assert from "node:assert/strict";

import { buildStudentPortalData } from "../lib/data/student-portal";

const baseLinkedMember = {
  id: "student-1",
  firstName: "Alice",
  lastName: "Adventurer",
  memberRole: "ADVENTURER",
  clubId: "club-1",
  clubName: "Central Club",
  clubCode: "CENT",
  rosterYearLabel: "2026",
};

test("linked user sees only explicitly linked student data", () => {
  const portalData = buildStudentPortalData({
    linkedRosterMembers: [baseLinkedMember],
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
    upcomingAttendances: [
      {
        rosterMemberId: "student-1",
        eventRegistration: {
          event: {
            id: "event-1",
            name: "Spring Camporee",
            startsAt: new Date("2026-04-01T09:00:00.000Z"),
            endsAt: new Date("2026-04-01T16:00:00.000Z"),
            locationName: "Camp Woods",
            locationAddress: null,
            eventBringNote: null,
          },
        },
      },
      {
        rosterMemberId: "student-2",
        eventRegistration: {
          event: {
            id: "event-1",
            name: "Spring Camporee",
            startsAt: new Date("2026-04-01T09:00:00.000Z"),
            endsAt: new Date("2026-04-01T16:00:00.000Z"),
            locationName: "Camp Woods",
            locationAddress: null,
            eventBringNote: null,
          },
        },
      },
    ],
    upcomingEnrollments: [
      {
        rosterMemberId: "student-1",
        offering: {
          eventId: "event-1",
          classCatalog: { title: "Nature Honor" },
        },
      },
      {
        rosterMemberId: "student-2",
        offering: {
          eventId: "event-1",
          classCatalog: { title: "Knots Honor" },
        },
      },
    ],
    honorCatalog: [
      { code: "HON-1", title: "Nature Honor" },
      { code: "HON-2", title: "Knots Honor" },
    ],
    directorContacts: [],
  });

  assert.equal(portalData.linkedStudents.length, 1);
  assert.equal(portalData.completedHonors.length, 1);
  assert.equal(portalData.completedHonors[0]?.rosterMemberName, "Alice Adventurer");
  assert.equal(portalData.eventClassAssignments.length, 1);
  assert.equal(portalData.eventClassAssignments[0]?.rosterMemberName, "Alice Adventurer");
  assert.equal(portalData.eventClassAssignments[0]?.classTitle, "Nature Honor");
});

test("multiple explicit student links are supported", () => {
  const portalData = buildStudentPortalData({
    linkedRosterMembers: [
      baseLinkedMember,
      {
        id: "student-2",
        firstName: "Ben",
        lastName: "Pathfinder",
        memberRole: "PATHFINDER",
        clubId: "club-1",
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
    upcomingAttendances: [],
    upcomingEnrollments: [],
    honorCatalog: [
      { code: "HON-1", title: "Nature Honor" },
      { code: "HON-2", title: "Knots Honor" },
    ],
    directorContacts: [],
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
    upcomingAttendances: [],
    upcomingEnrollments: [],
    honorCatalog: [{ code: "HON-1", title: "Nature Honor" }],
    directorContacts: [],
  });

  assert.equal(portalData.linkedStudents.length, 0);
  assert.equal(portalData.completedHonors.length, 0);
  assert.equal(portalData.eventClassAssignments.length, 0);
  assert.equal(portalData.directorContacts.length, 0);
});

test("events without class enrollment show null classTitle", () => {
  const portalData = buildStudentPortalData({
    linkedRosterMembers: [baseLinkedMember],
    completedRequirements: [],
    upcomingAttendances: [
      {
        rosterMemberId: "student-1",
        eventRegistration: {
          event: {
            id: "event-2",
            name: "Fall Retreat",
            startsAt: new Date("2026-10-01T09:00:00.000Z"),
            endsAt: new Date("2026-10-03T16:00:00.000Z"),
            locationName: "Lake Camp",
            locationAddress: "123 Lake Rd, Springfield",
            eventBringNote: "Bring sleeping bag, water bottle, and sunscreen.",
          },
        },
      },
    ],
    upcomingEnrollments: [],
    honorCatalog: [],
    directorContacts: [],
  });

  assert.equal(portalData.eventClassAssignments.length, 1);
  assert.equal(portalData.eventClassAssignments[0]?.classTitle, null);
  assert.equal(portalData.eventClassAssignments[0]?.locationAddress, "123 Lake Rd, Springfield");
  assert.equal(portalData.eventClassAssignments[0]?.eventBringNote, "Bring sleeping bag, water bottle, and sunscreen.");
});

test("director contacts are included for linked clubs", () => {
  const portalData = buildStudentPortalData({
    linkedRosterMembers: [baseLinkedMember],
    completedRequirements: [],
    upcomingAttendances: [],
    upcomingEnrollments: [],
    honorCatalog: [],
    directorContacts: [
      { clubId: "club-1", name: "Jane Director", email: "jane@example.org" },
    ],
  });

  assert.equal(portalData.directorContacts.length, 1);
  assert.equal(portalData.directorContacts[0]?.name, "Jane Director");
  assert.equal(portalData.directorContacts[0]?.email, "jane@example.org");
  assert.equal(portalData.directorContacts[0]?.clubName, "Central Club");
});
