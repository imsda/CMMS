import test from "node:test";
import assert from "node:assert/strict";
import { MemberRole, MemberStatus } from "@prisma/client";

// Unit tests: walk-in member filtering logic (no DB required)

test("walk-in members are excluded from yearly rollover member selection", () => {
  type MockMember = {
    id: string;
    firstName: string;
    lastName: string;
    memberStatus: MemberStatus;
    isActive: boolean;
  };

  const members: MockMember[] = [
    { id: "1", firstName: "Alice", lastName: "A", memberStatus: MemberStatus.ACTIVE, isActive: true },
    { id: "2", firstName: "Bob", lastName: "B", memberStatus: MemberStatus.WALK_IN, isActive: true },
    { id: "3", firstName: "Carol", lastName: "C", memberStatus: MemberStatus.INACTIVE, isActive: false },
  ];

  // Simulate rollover filter: isActive AND not WALK_IN
  const rolloverMembers = members.filter(
    (m) => m.isActive && m.memberStatus !== MemberStatus.WALK_IN,
  );

  assert.equal(rolloverMembers.length, 1);
  assert.equal(rolloverMembers[0]?.id, "1");
});

test("walk-in members are excluded from compliance count reports", () => {
  type MockMember = {
    memberRole: MemberRole;
    memberStatus: MemberStatus;
  };

  const members: MockMember[] = [
    { memberRole: MemberRole.PATHFINDER, memberStatus: MemberStatus.ACTIVE },
    { memberRole: MemberRole.PATHFINDER, memberStatus: MemberStatus.WALK_IN },
    { memberRole: MemberRole.STAFF, memberStatus: MemberStatus.ACTIVE },
    { memberRole: MemberRole.STAFF, memberStatus: MemberStatus.WALK_IN },
    { memberRole: MemberRole.TLT, memberStatus: MemberStatus.ACTIVE },
  ];

  // Simulate compliance count filter: exclude WALK_IN
  const countableMembers = members.filter((m) => m.memberStatus !== MemberStatus.WALK_IN);

  const counts = countableMembers.reduce(
    (acc, m) => {
      if (m.memberRole === MemberRole.PATHFINDER) acc.pathfinderCount += 1;
      else if (m.memberRole === MemberRole.TLT) acc.tltCount += 1;
      else if (m.memberRole === MemberRole.STAFF) acc.staffCount += 1;
      return acc;
    },
    { pathfinderCount: 0, tltCount: 0, staffCount: 0 },
  );

  assert.equal(counts.pathfinderCount, 1);
  assert.equal(counts.staffCount, 1);
  assert.equal(counts.tltCount, 1);
});

test("walk-in STAFF attendees bypass background check validation", () => {
  type MockMember = {
    id: string;
    memberRole: MemberRole;
    memberStatus: MemberStatus;
    backgroundCheckCleared: boolean;
  };

  const attendees: MockMember[] = [
    { id: "1", memberRole: MemberRole.STAFF, memberStatus: MemberStatus.ACTIVE, backgroundCheckCleared: false },
    { id: "2", memberRole: MemberRole.STAFF, memberStatus: MemberStatus.WALK_IN, backgroundCheckCleared: false },
    { id: "3", memberRole: MemberRole.DIRECTOR, memberStatus: MemberStatus.ACTIVE, backgroundCheckCleared: true },
  ];

  // Simulate background check validation: skip WALK_IN
  const missingClearance = attendees
    .filter(
      (m) =>
        m.memberStatus !== MemberStatus.WALK_IN &&
        (m.memberRole === MemberRole.STAFF || m.memberRole === MemberRole.DIRECTOR) &&
        !m.backgroundCheckCleared,
    )
    .map((m) => m.id);

  assert.deepEqual(missingClearance, ["1"]);
});
