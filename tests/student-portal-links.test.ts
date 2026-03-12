import test from "node:test";
import assert from "node:assert/strict";
import { MemberRole } from "@prisma/client";

import { isStudentPortalEligibleMemberRole } from "../lib/student-portal-links";

test("only student roles are eligible for explicit portal links", () => {
  assert.equal(isStudentPortalEligibleMemberRole(MemberRole.CHILD), true);
  assert.equal(isStudentPortalEligibleMemberRole(MemberRole.ADVENTURER), true);
  assert.equal(isStudentPortalEligibleMemberRole(MemberRole.PATHFINDER), true);
  assert.equal(isStudentPortalEligibleMemberRole(MemberRole.TLT), true);
  assert.equal(isStudentPortalEligibleMemberRole(MemberRole.STAFF), false);
  assert.equal(isStudentPortalEligibleMemberRole(MemberRole.DIRECTOR), false);
  assert.equal(isStudentPortalEligibleMemberRole(MemberRole.COUNSELOR), false);
});
