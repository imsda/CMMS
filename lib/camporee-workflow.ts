import { EventWorkflowType, RegistrationStatus, type Event, type EventFormField } from "@prisma/client";

export const CAMPOREE_DUTY_PREFERENCES = [
  "Drill",
  "First Aid",
  "Bible Experience",
  "Pioneering",
  "Kitchen Duty",
  "Flag Team",
  "Camp Setup",
] as const;

export const CAMPOREE_PARTICIPATION_HIGHLIGHTS = [
  "Honor Fair",
  "Sabbath Parade",
  "Community Service",
  "Worship Team",
  "Outreach Display",
  "General Participation",
] as const;

export const CAMPOREE_CAMPSITE_TYPES = ["Primitive", "RV", "Cabin", "Mixed"] as const;
export const CAMPOREE_MEAL_PLANS = ["Self-Catered", "Conference Meals", "Mixed"] as const;

const LEGACY_CAMPOREE_FIELD_KEYS = new Set([
  "camporee_contact_name",
  "camporee_contact_phone",
  "campsite_type",
  "tent_summary",
]);

export function isCamporeeWorkflowEvent(input: {
  workflowType: EventWorkflowType;
  dynamicFields?: Array<Pick<EventFormField, "key">>;
}) {
  if (input.workflowType === EventWorkflowType.CAMPOREE) {
    return true;
  }

  return (
    input.dynamicFields?.some((field) => LEGACY_CAMPOREE_FIELD_KEYS.has(field.key)) ?? false
  );
}

export function canAdminReviewRegistration(status: RegistrationStatus) {
  return status === RegistrationStatus.SUBMITTED || status === RegistrationStatus.REVIEWED;
}

export function formatCamporeeRegistrationStatus(status: RegistrationStatus) {
  switch (status) {
    case RegistrationStatus.NEEDS_CHANGES:
      return "Needs Changes";
    case RegistrationStatus.REVIEWED:
      return "Reviewed";
    default:
      return status.replaceAll("_", " ");
  }
}

export type CamporeeEventLike = Pick<Event, "workflowType"> & {
  dynamicFields?: Array<Pick<EventFormField, "key">>;
};
