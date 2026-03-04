import { RequirementType, type MemberRole } from "@prisma/client";

export type RequirementInput = {
  requirementType: RequirementType;
  minAge: number | null;
  maxAge: number | null;
  requiredMemberRole: MemberRole | null;
  requiredHonorCode: string | null;
  requiredMasterGuide: boolean | null;
};

export type AttendeeEligibilityInput = {
  ageAtStart: number | null;
  memberRole: MemberRole;
  masterGuide: boolean;
  completedHonorCodes: string[];
};

export type RequirementEvaluation = {
  eligible: boolean;
  blockers: string[];
};

function normalizeHonorCode(code: string) {
  return code.trim().toUpperCase();
}

export function requirementToBadgeLabel(requirement: RequirementInput) {
  switch (requirement.requirementType) {
    case RequirementType.MIN_AGE:
      return requirement.minAge !== null ? `Requires Age ${requirement.minAge}+` : "Minimum age required";
    case RequirementType.MAX_AGE:
      return requirement.maxAge !== null ? `Max Age ${requirement.maxAge}` : "Maximum age restriction";
    case RequirementType.MEMBER_ROLE:
      return requirement.requiredMemberRole
        ? `Requires ${requirement.requiredMemberRole.replaceAll("_", " ")} Role`
        : "Specific member role required";
    case RequirementType.COMPLETED_HONOR:
      return requirement.requiredHonorCode
        ? `Requires Honor ${requirement.requiredHonorCode}`
        : "Completed honor required";
    case RequirementType.MASTER_GUIDE:
      return requirement.requiredMasterGuide ? "Requires Master Guide" : "Master Guide restriction";
    default:
      return "Requirement applies";
  }
}

export function evaluateClassRequirements(
  attendee: AttendeeEligibilityInput,
  requirements: RequirementInput[],
): RequirementEvaluation {
  const blockers: string[] = [];
  const completedHonorCodeSet = new Set(attendee.completedHonorCodes.map(normalizeHonorCode));

  for (const requirement of requirements) {
    switch (requirement.requirementType) {
      case RequirementType.MIN_AGE:
        if (requirement.minAge !== null && (attendee.ageAtStart === null || attendee.ageAtStart < requirement.minAge)) {
          blockers.push(requirementToBadgeLabel(requirement));
        }
        break;
      case RequirementType.MAX_AGE:
        if (requirement.maxAge !== null && attendee.ageAtStart !== null && attendee.ageAtStart > requirement.maxAge) {
          blockers.push(requirementToBadgeLabel(requirement));
        }
        break;
      case RequirementType.MEMBER_ROLE:
        if (requirement.requiredMemberRole !== null && attendee.memberRole !== requirement.requiredMemberRole) {
          blockers.push(requirementToBadgeLabel(requirement));
        }
        break;
      case RequirementType.COMPLETED_HONOR:
        if (
          requirement.requiredHonorCode !== null &&
          !completedHonorCodeSet.has(normalizeHonorCode(requirement.requiredHonorCode))
        ) {
          blockers.push(requirementToBadgeLabel(requirement));
        }
        break;
      case RequirementType.MASTER_GUIDE:
        if (requirement.requiredMasterGuide === true && attendee.masterGuide !== true) {
          blockers.push(requirementToBadgeLabel(requirement));
        }
        break;
      default:
        blockers.push("Requirement applies");
    }
  }

  return {
    eligible: blockers.length === 0,
    blockers,
  };
}
