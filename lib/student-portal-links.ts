import { MemberRole } from "@prisma/client";

export const STUDENT_PORTAL_MEMBER_ROLES: MemberRole[] = [
  MemberRole.CHILD,
  MemberRole.ADVENTURER,
  MemberRole.PATHFINDER,
  MemberRole.TLT,
];

export function isStudentPortalEligibleMemberRole(role: MemberRole) {
  return STUDENT_PORTAL_MEMBER_ROLES.includes(role);
}

export function getRosterMemberDisplayName(member: { firstName: string; lastName: string }) {
  return `${member.firstName} ${member.lastName}`.trim();
}
