import test from "node:test";
import assert from "node:assert/strict";
import { MemberRole } from "@prisma/client";

import {
  buildCompliancePreview,
  getCompliancePreviewRowsEligibleForApply,
  parseSterlingCsv,
} from "../lib/compliance-sync";

test("compliance preview scopes safe updates to a unique roster-year match", () => {
  const records = parseSterlingCsv(
    [
      "First Name,Last Name,Status,DOB",
      "Alice,Smith,Y,01/02/1980",
    ].join("\n"),
  );

  const preview = buildCompliancePreview(records, [
    {
      id: "member-1",
      firstName: "Alice",
      lastName: "Smith",
      memberRole: MemberRole.DIRECTOR,
      dateOfBirth: new Date("1980-01-02T00:00:00.000Z"),
    },
  ]);

  assert.equal(preview.updateCount, 1);
  assert.equal(preview.ambiguousCount, 0);
  assert.equal(preview.rowResults[0]?.matchedRosterMemberId, "member-1");
});

test("compliance preview marks same-name adults without DOB as ambiguous", () => {
  const records = parseSterlingCsv(
    [
      "First Name,Last Name,Status",
      "Alice,Smith,Y",
    ].join("\n"),
  );

  const preview = buildCompliancePreview(records, [
    {
      id: "member-1",
      firstName: "Alice",
      lastName: "Smith",
      memberRole: MemberRole.DIRECTOR,
      dateOfBirth: new Date("1980-01-02T00:00:00.000Z"),
    },
    {
      id: "member-2",
      firstName: "Alice",
      lastName: "Smith",
      memberRole: MemberRole.STAFF,
      dateOfBirth: new Date("1981-01-02T00:00:00.000Z"),
    },
  ]);

  assert.equal(preview.updateCount, 0);
  assert.equal(preview.ambiguousCount, 1);
  assert.equal(preview.rowResults[0]?.action, "AMBIGUOUS");
});

test("compliance preview treats malformed DOB rows as ambiguous instead of falling back to name-only matching", () => {
  const records = parseSterlingCsv(
    [
      "First Name,Last Name,Status,DOB",
      "Alice,Smith,Y,not-a-date",
    ].join("\n"),
  );

  const preview = buildCompliancePreview(records, [
    {
      id: "member-1",
      firstName: "Alice",
      lastName: "Smith",
      memberRole: MemberRole.DIRECTOR,
      dateOfBirth: new Date("1980-01-02T00:00:00.000Z"),
    },
  ]);

  assert.equal(preview.updateCount, 0);
  assert.equal(preview.ambiguousCount, 1);
  assert.equal(records[0]?.dateOfBirthInvalid, true);
  assert.equal(preview.rowResults[0]?.action, "AMBIGUOUS");
});

test("compliance apply selection excludes skipped and ambiguous rows", () => {
  const applicableRows = getCompliancePreviewRowsEligibleForApply([
    {
      rowNumber: 2,
      firstName: "Alice",
      lastName: "Smith",
      status: "Y",
      dateOfBirth: "1980-01-02",
      action: "UPDATE",
      reason: "Matched safely.",
      matchedRosterMemberId: "member-1",
      matchedDisplayName: "Alice Smith (DIRECTOR)",
    },
    {
      rowNumber: 3,
      firstName: "Bob",
      lastName: "Smith",
      status: "Y",
      dateOfBirth: null,
      action: "AMBIGUOUS",
      reason: "Multiple matches.",
      matchedRosterMemberId: null,
      matchedDisplayName: null,
    },
    {
      rowNumber: 4,
      firstName: "Cara",
      lastName: "Jones",
      status: "N",
      dateOfBirth: null,
      action: "SKIP",
      reason: "Not passed.",
      matchedRosterMemberId: null,
      matchedDisplayName: null,
    },
  ]);

  assert.equal(applicableRows.length, 1);
  assert.equal(applicableRows[0]?.matchedRosterMemberId, "member-1");
});
