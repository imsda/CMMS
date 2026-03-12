import test from "node:test";
import assert from "node:assert/strict";
import { MemberRole, UserRole } from "@prisma/client";

import { applyComplianceSyncRun } from "../app/actions/compliance-actions";
import { prisma } from "../lib/prisma";
import {
  disconnectIntegrationPrisma,
  hasIntegrationDatabase,
  resetIntegrationDatabase,
} from "./integration-helpers";

test("compliance apply records row-level audit details for each applied update", { skip: !hasIntegrationDatabase }, async () => {
  await resetIntegrationDatabase();

  const admin = await prisma.user.create({
    data: {
      email: "admin@example.org",
      name: "Admin",
      role: UserRole.SUPER_ADMIN,
    },
  });

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
      lastName: "Smith",
      memberRole: MemberRole.DIRECTOR,
      photoReleaseConsent: true,
      medicalTreatmentConsent: true,
      membershipAgreementConsent: true,
    },
  });

  const run = await prisma.complianceSyncRun.create({
    data: {
      uploadedByUserId: admin.id,
      clubId: club.id,
      clubRosterYearId: rosterYear.id,
      fileName: "sterling.csv",
      processedRows: 1,
      passedRows: 1,
      updateCount: 1,
      skippedCount: 0,
      ambiguousCount: 0,
      rowResults: [
        {
          rowNumber: 2,
          firstName: "Alice",
          lastName: "Smith",
          status: "Y",
          dateOfBirth: null,
          action: "UPDATE",
          reason: "Matched safely.",
          matchedRosterMemberId: member.id,
          matchedDisplayName: "Alice Smith (DIRECTOR)",
        },
      ],
    },
  });

  const result = await applyComplianceSyncRun(run.id, admin.id);

  assert.equal(result.updatedCount, 1);

  const updatedMember = await prisma.rosterMember.findUniqueOrThrow({
    where: {
      id: member.id,
    },
  });
  assert.equal(updatedMember.backgroundCheckCleared, true);
  assert.ok(updatedMember.backgroundCheckDate instanceof Date);

  const updatedRun = await prisma.complianceSyncRun.findUniqueOrThrow({
    where: {
      id: run.id,
    },
  });

  assert.equal(updatedRun.appliedByUserId, admin.id);
  assert.ok(updatedRun.appliedAt instanceof Date);
  assert.ok(Array.isArray(updatedRun.rowResults));
  assert.equal((updatedRun.rowResults as Array<{ appliedChange?: { result?: string } }>)[0]?.appliedChange?.result, "UPDATED");
});

test.after(async () => {
  await disconnectIntegrationPrisma();
});
