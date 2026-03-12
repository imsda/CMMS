import test from "node:test";
import assert from "node:assert/strict";
import { MemberRole, UserRole } from "@prisma/client";

import { assignStudentPortalLink } from "../app/actions/admin-management-actions";
import { getStudentPortalData } from "../lib/data/student-portal";
import { prisma } from "../lib/prisma";
import {
  disconnectIntegrationPrisma,
  hasIntegrationDatabase,
  resetIntegrationDatabase,
} from "./integration-helpers";

test("portal linking uses explicit link rows for access control", { skip: !hasIntegrationDatabase }, async () => {
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

  const linkedStudent = await prisma.rosterMember.create({
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

  const unlinkedStudent = await prisma.rosterMember.create({
    data: {
      clubRosterYearId: rosterYear.id,
      firstName: "Ben",
      lastName: "Pathfinder",
      memberRole: MemberRole.ADVENTURER,
      photoReleaseConsent: true,
      medicalTreatmentConsent: true,
      membershipAgreementConsent: true,
    },
  });

  const parent = await prisma.user.create({
    data: {
      email: "parent@example.org",
      name: "Parent",
      role: UserRole.STUDENT_PARENT,
    },
  });

  const otherParent = await prisma.user.create({
    data: {
      email: "other-parent@example.org",
      name: "Other Parent",
      role: UserRole.STUDENT_PARENT,
    },
  });

  await assignStudentPortalLink(parent.id, linkedStudent.id);

  const parentPortal = await getStudentPortalData(parent.id);
  const otherPortal = await getStudentPortalData(otherParent.id);

  assert.equal(parentPortal.linkedStudents.length, 1);
  assert.equal(parentPortal.linkedStudents[0]?.rosterMemberId, linkedStudent.id);
  assert.equal(parentPortal.linkedStudents.some((student) => student.rosterMemberId === unlinkedStudent.id), false);
  assert.equal(otherPortal.linkedStudents.length, 0);
});

test.after(async () => {
  await disconnectIntegrationPrisma();
});
