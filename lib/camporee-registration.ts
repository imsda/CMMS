import {
  CAMPOREE_CAMPSITE_TYPES,
  CAMPOREE_DUTY_PREFERENCES,
  CAMPOREE_MEAL_PLANS,
  CAMPOREE_PARTICIPATION_HIGHLIGHTS,
} from "./camporee-workflow";

export type CamporeeRegistrationPayload = {
  attendeeIds: string[];
  primaryContactName: string;
  primaryContactPhone: string;
  primaryContactEmail: string;
  secondaryContactName: string;
  secondaryContactPhone: string;
  campsiteType: string;
  tentSummary: string;
  trailerCount: number;
  kitchenCanopyCount: number;
  squareFootageNeeded: number;
  campNearRequest: string;
  campsiteNotes: string;
  arrivalDateTime: string;
  departureDateTime: string;
  vehicleCount: number;
  transportSummary: string;
  arrivalNotes: string;
  mealPlan: string;
  sabbathSupperCount: number;
  sundayBreakfastCount: number;
  waterServiceNeeded: boolean;
  foodPlanningNotes: string;
  dietaryNotes: string;
  dutyPreferences: string[];
  participationHighlights: string[];
  firstAidCertifiedCount: number;
  leadershipStaffCount: number;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyMeetingPoint: string;
  medicationStorageNotes: string;
  emergencyNotes: string;
  chaplainVisitRequested: boolean;
  worshipParticipationNotes: string;
  ministryDisplayNotes: string;
  finalReviewNotes: string;
};

export const EMPTY_CAMPOREE_REGISTRATION: CamporeeRegistrationPayload = {
  attendeeIds: [],
  primaryContactName: "",
  primaryContactPhone: "",
  primaryContactEmail: "",
  secondaryContactName: "",
  secondaryContactPhone: "",
  campsiteType: CAMPOREE_CAMPSITE_TYPES[0],
  tentSummary: "",
  trailerCount: 0,
  kitchenCanopyCount: 0,
  squareFootageNeeded: 0,
  campNearRequest: "",
  campsiteNotes: "",
  arrivalDateTime: "",
  departureDateTime: "",
  vehicleCount: 0,
  transportSummary: "",
  arrivalNotes: "",
  mealPlan: CAMPOREE_MEAL_PLANS[0],
  sabbathSupperCount: 0,
  sundayBreakfastCount: 0,
  waterServiceNeeded: false,
  foodPlanningNotes: "",
  dietaryNotes: "",
  dutyPreferences: [],
  participationHighlights: [],
  firstAidCertifiedCount: 0,
  leadershipStaffCount: 0,
  emergencyContactName: "",
  emergencyContactPhone: "",
  emergencyMeetingPoint: "",
  medicationStorageNotes: "",
  emergencyNotes: "",
  chaplainVisitRequested: false,
  worshipParticipationNotes: "",
  ministryDisplayNotes: "",
  finalReviewNotes: "",
};

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeInt(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return 0;
}

function normalizeStringArray(value: unknown, allowed: readonly string[]) {
  if (!Array.isArray(value)) {
    return [];
  }

  const allowedSet = new Set(allowed);
  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0 && allowedSet.has(entry)),
    ),
  );
}

export function parseCamporeeRegistrationPayload(rawPayload: FormDataEntryValue | null) {
  if (typeof rawPayload !== "string" || rawPayload.trim().length === 0) {
    throw new Error("Camporee registration payload is required.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawPayload);
  } catch {
    throw new Error("Camporee registration payload is invalid JSON.");
  }

  const candidate = parsed as Record<string, unknown>;

  return {
    attendeeIds: Array.isArray(candidate.attendeeIds)
      ? Array.from(
          new Set(
            candidate.attendeeIds
              .filter((value): value is string => typeof value === "string")
              .map((value) => value.trim())
              .filter((value) => value.length > 0),
          ),
        )
      : [],
    primaryContactName: normalizeString(candidate.primaryContactName),
    primaryContactPhone: normalizeString(candidate.primaryContactPhone),
    primaryContactEmail: normalizeString(candidate.primaryContactEmail),
    secondaryContactName: normalizeString(candidate.secondaryContactName),
    secondaryContactPhone: normalizeString(candidate.secondaryContactPhone),
    campsiteType: normalizeString(candidate.campsiteType) || CAMPOREE_CAMPSITE_TYPES[0],
    tentSummary: normalizeString(candidate.tentSummary),
    trailerCount: normalizeInt(candidate.trailerCount),
    kitchenCanopyCount: normalizeInt(candidate.kitchenCanopyCount),
    squareFootageNeeded: normalizeInt(candidate.squareFootageNeeded),
    campNearRequest: normalizeString(candidate.campNearRequest),
    campsiteNotes: normalizeString(candidate.campsiteNotes),
    arrivalDateTime: normalizeString(candidate.arrivalDateTime),
    departureDateTime: normalizeString(candidate.departureDateTime),
    vehicleCount: normalizeInt(candidate.vehicleCount),
    transportSummary: normalizeString(candidate.transportSummary),
    arrivalNotes: normalizeString(candidate.arrivalNotes),
    mealPlan: normalizeString(candidate.mealPlan) || CAMPOREE_MEAL_PLANS[0],
    sabbathSupperCount: normalizeInt(candidate.sabbathSupperCount),
    sundayBreakfastCount: normalizeInt(candidate.sundayBreakfastCount),
    waterServiceNeeded: Boolean(candidate.waterServiceNeeded),
    foodPlanningNotes: normalizeString(candidate.foodPlanningNotes),
    dietaryNotes: normalizeString(candidate.dietaryNotes),
    dutyPreferences: normalizeStringArray(candidate.dutyPreferences, CAMPOREE_DUTY_PREFERENCES),
    participationHighlights: normalizeStringArray(
      candidate.participationHighlights,
      CAMPOREE_PARTICIPATION_HIGHLIGHTS,
    ),
    firstAidCertifiedCount: normalizeInt(candidate.firstAidCertifiedCount),
    leadershipStaffCount: normalizeInt(candidate.leadershipStaffCount),
    emergencyContactName: normalizeString(candidate.emergencyContactName),
    emergencyContactPhone: normalizeString(candidate.emergencyContactPhone),
    emergencyMeetingPoint: normalizeString(candidate.emergencyMeetingPoint),
    medicationStorageNotes: normalizeString(candidate.medicationStorageNotes),
    emergencyNotes: normalizeString(candidate.emergencyNotes),
    chaplainVisitRequested: Boolean(candidate.chaplainVisitRequested),
    worshipParticipationNotes: normalizeString(candidate.worshipParticipationNotes),
    ministryDisplayNotes: normalizeString(candidate.ministryDisplayNotes),
    finalReviewNotes: normalizeString(candidate.finalReviewNotes),
  } satisfies CamporeeRegistrationPayload;
}

export function validateCamporeeRegistrationPayload(
  payload: CamporeeRegistrationPayload,
  options: { requireCompleteSubmission: boolean },
) {
  if (!options.requireCompleteSubmission) {
    return;
  }

  if (payload.attendeeIds.length === 0) {
    throw new Error("Select at least one attendee before submitting Camporee registration.");
  }

  if (payload.primaryContactName.length === 0 || payload.primaryContactPhone.length === 0) {
    throw new Error("Primary Camporee contact name and phone are required.");
  }

  if (payload.tentSummary.length === 0 || payload.squareFootageNeeded <= 0) {
    throw new Error("Campsite tent summary and estimated square footage are required.");
  }

  if (payload.emergencyContactName.length === 0 || payload.emergencyContactPhone.length === 0) {
    throw new Error("Emergency contact name and phone are required.");
  }

  if (!CAMPOREE_CAMPSITE_TYPES.includes(payload.campsiteType as (typeof CAMPOREE_CAMPSITE_TYPES)[number])) {
    throw new Error("Camporee campsite type is invalid.");
  }

  if (!CAMPOREE_MEAL_PLANS.includes(payload.mealPlan as (typeof CAMPOREE_MEAL_PLANS)[number])) {
    throw new Error("Camporee meal plan is invalid.");
  }
}
