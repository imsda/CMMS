import {
  ClassType,
  EventMode,
  EventTemplateCategory,
  EventTemplateSource,
  FormFieldScope,
  FormFieldType,
  MemberRole,
  PrismaClient,
  RequirementType,
  UserRole,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { buildEventTemplateSnapshot } from "../lib/event-templates";

const prisma = new PrismaClient();

const DEFAULT_SUPER_ADMIN_EMAIL =
  process.env.SEED_SUPER_ADMIN_EMAIL ?? "superadmin@cmms.local";
const DEFAULT_SUPER_ADMIN_PASSWORD =
  process.env.SEED_SUPER_ADMIN_PASSWORD ?? "ChangeMeNow123!";
const DEFAULT_SUPER_ADMIN_NAME =
  process.env.SEED_SUPER_ADMIN_NAME ?? "CMMS Super Admin";

const DEFAULT_CLUB_CODE = "CONF-TEST-CLUB";

type SeedRequirement = {
  requirementType: RequirementType;
  config: Record<string, unknown>;
};

type SeedHonor = {
  code: string;
  title: string;
  description: string;
  requirements: SeedRequirement[];
};

type SeedDynamicField = {
  id: string;
  parentFieldId: string | null;
  key: string;
  label: string;
  description?: string | null;
  type: FormFieldType;
  fieldScope?: FormFieldScope;
  isRequired?: boolean;
  options?: unknown;
};

const DEFAULT_HONORS = [
  {
    code: "HONOR-KNTS-001",
    title: "Knots",
    description: "Learn and demonstrate essential camping and safety knots.",
    requirements: [],
  },
  {
    code: "HONOR-CAMP-001",
    title: "Camping Skills",
    description:
      "Covers campsite setup, fire safety, and basic outdoor preparedness.",
    requirements: [
      {
        requirementType: RequirementType.MIN_AGE,
        config: {
          minAge: 10,
        },
      },
    ],
  },
  {
    code: "HONOR-FIRSTAID-001",
    title: "First Aid",
    description:
      "Demonstrate foundational first aid knowledge for common injuries.",
    requirements: [
      {
        requirementType: RequirementType.MIN_AGE,
        config: {
          minAge: 12,
        },
      },
    ],
  },
  {
    code: "HONOR-ORIENT-ADV-001",
    title: "Orienteering Advanced",
    description:
      "Advanced map-and-compass navigation including route planning and terrain analysis.",
    requirements: [
      {
        requirementType: RequirementType.MIN_AGE,
        config: {
          minAge: 15,
        },
      },
      {
        requirementType: RequirementType.COMPLETED_HONOR,
        config: {
          requiredHonorCode: "HONOR-KNTS-001",
        },
      },
    ],
  },
  {
    code: "HONOR-LEAD-ADV-001",
    title: "Pathfinder Leadership Advanced",
    description:
      "Develop advanced mentoring and leadership competencies for senior pathfinders.",
    requirements: [
      {
        requirementType: RequirementType.MIN_AGE,
        config: {
          minAge: 15,
        },
      },
      {
        requirementType: RequirementType.MEMBER_ROLE,
        config: {
          requiredMemberRole: MemberRole.PATHFINDER,
        },
      },
    ],
  },
] satisfies SeedHonor[];

function templateField(input: SeedDynamicField) {
  return {
    description: "",
    fieldScope: FormFieldScope.GLOBAL,
    isRequired: false,
    options: null,
    ...input,
  };
}

function templateGroup(id: string, key: string, label: string, description: string) {
  return templateField({
    id,
    parentFieldId: null,
    key,
    label,
    description,
    type: FormFieldType.FIELD_GROUP,
    fieldScope: FormFieldScope.GLOBAL,
    isRequired: false,
    options: null,
  });
}

const OFFICIAL_EVENT_TEMPLATES = [
  {
    templateKey: "system-honors-weekend",
    name: "Honors Weekend",
    description: "Conference honors weekend starter with club contacts, logistics, housing and meals, attendee prep, and honor preference placeholders.",
    eventMode: EventMode.CLASS_ASSIGNMENT,
    category: EventTemplateCategory.CLASS_ASSIGNMENT,
    snapshot: buildEventTemplateSnapshot({
      eventMode: EventMode.CLASS_ASSIGNMENT,
      name: "Honors Weekend",
      description: "Conference honors weekend starter with roster attendee selection, club logistics, housing and meals, and honor-preference placeholders ahead of final class assignments.",
      startsAt: new Date("2026-09-18T22:00:00.000Z"),
      endsAt: new Date("2026-09-20T20:00:00.000Z"),
      registrationOpensAt: new Date("2026-08-01T00:00:00.000Z"),
      registrationClosesAt: new Date("2026-09-01T00:00:00.000Z"),
      basePrice: 35,
      lateFeePrice: 45,
      lateFeeStartsAt: new Date("2026-08-20T00:00:00.000Z"),
      locationName: "Conference Camp",
      locationAddress: "123 Camp Rd",
      dynamicFields: [
        templateGroup("club-contact-group", "club_contact", "Club Contact", "Primary conference coordination details for the attending club."),
        templateField({
          id: "club-contact-name",
          parentFieldId: "club-contact-group",
          key: "primary_contact_name",
          label: "Primary contact name",
          description: "Lead adult coordinating the club registration.",
          type: FormFieldType.SHORT_TEXT,
          isRequired: true,
        }),
        templateField({
          id: "club-contact-phone",
          parentFieldId: "club-contact-group",
          key: "primary_contact_phone",
          label: "Primary contact phone",
          description: "Best phone number for pre-event follow-up.",
          type: FormFieldType.SHORT_TEXT,
          isRequired: true,
        }),
        templateField({
          id: "onsite-emergency-contact",
          parentFieldId: "club-contact-group",
          key: "onsite_emergency_contact",
          label: "Emergency contact on site",
          description: "Adult contact available during the full weekend.",
          type: FormFieldType.SHORT_TEXT,
          isRequired: true,
        }),
        templateGroup("honors-ack-group", "honors_acknowledgement", "Acknowledgement", "Conference readiness confirmations before final class assignment."),
        templateField({
          id: "roster-complete",
          parentFieldId: "honors-ack-group",
          key: "roster_review_complete",
          label: "Roster reviewed and attendee list confirmed",
          description: "Confirm the roster is current before attendee selection and scheduling.",
          type: FormFieldType.BOOLEAN,
          isRequired: true,
        }),
        templateField({
          id: "prereq-review-complete",
          parentFieldId: "honors-ack-group",
          key: "prerequisite_review_complete",
          label: "Prerequisite requirements reviewed with attendees",
          description: "Use this as a placeholder acknowledgement until full class placement is finalized.",
          type: FormFieldType.BOOLEAN,
          isRequired: true,
        }),
        templateGroup("transport-group", "transportation", "Transportation", "Travel planning details for your club."),
        templateField({
          id: "transport-mode",
          parentFieldId: "transport-group",
          key: "transportation_mode",
          label: "Transportation mode",
          description: "Primary way the club will travel to the event.",
          type: FormFieldType.SINGLE_SELECT,
          isRequired: true,
          options: ["Church van", "School bus", "Personal vehicles", "Mixed transportation"],
        }),
        templateField({
          id: "arrival-time",
          parentFieldId: "transport-group",
          key: "arrival_time",
          label: "Estimated arrival time",
          description: "Approximate Friday arrival for check-in planning.",
          type: FormFieldType.SHORT_TEXT,
          isRequired: true,
        }),
        templateField({
          id: "transport-notes",
          parentFieldId: "transport-group",
          key: "transport_notes",
          label: "Transportation notes",
          description: "Parking, late arrival, or special transport notes.",
          type: FormFieldType.LONG_TEXT,
        }),
        templateGroup("housing-meals-group", "housing_meals", "Housing and Meals", "Starter logistics for cabins, dorms, and meal planning."),
        templateField({
          id: "housing-choice",
          parentFieldId: "housing-meals-group",
          key: "housing_choice",
          label: "Housing choice",
          description: "Select the primary lodging plan for the club.",
          type: FormFieldType.SINGLE_SELECT,
          isRequired: true,
          options: ["Dorm housing", "Cabin housing", "Bring your own housing", "Commuting only"],
        }),
        templateField({
          id: "supper-count",
          parentFieldId: "housing-meals-group",
          key: "supper_count",
          label: "Friday supper count",
          description: "Number of meals needed for Friday evening.",
          type: FormFieldType.NUMBER,
          isRequired: true,
        }),
        templateField({
          id: "breakfast-count",
          parentFieldId: "housing-meals-group",
          key: "breakfast_count",
          label: "Sabbath breakfast count",
          description: "Number of meals needed for Sabbath morning.",
          type: FormFieldType.NUMBER,
          isRequired: true,
        }),
        templateField({
          id: "lunch-count",
          parentFieldId: "housing-meals-group",
          key: "lunch_count",
          label: "Sabbath lunch count",
          description: "Number of lunches needed for the club.",
          type: FormFieldType.NUMBER,
          isRequired: true,
        }),
        templateGroup("honor-planning-group", "honor_planning", "Honor Planning", "Starter preference prompts before the full class assignment workflow takes over."),
        templateField({
          id: "preferred-honor-areas",
          parentFieldId: "honor-planning-group",
          key: "preferred_honor_areas",
          label: "Preferred honor areas",
          description: "Use this as a broad interest signal before final class placements.",
          type: FormFieldType.MULTI_SELECT,
          options: ["Outdoor Skills", "Nature", "Arts and Crafts", "Health and Safety", "Leadership"],
        }),
        templateField({
          id: "class-preference",
          parentFieldId: "honor-planning-group",
          key: "class_preference",
          label: "Honor preference",
          description: "Optional attendee-level preference to help with early class planning.",
          type: FormFieldType.SHORT_TEXT,
          fieldScope: FormFieldScope.ATTENDEE,
        }),
        templateField({
          id: "attendee-prereq-ack",
          parentFieldId: "honor-planning-group",
          key: "attendee_prerequisite_acknowledgement",
          label: "Prerequisites complete or understood",
          description: "Attendee-level placeholder acknowledgement until final enrollment review.",
          type: FormFieldType.BOOLEAN,
          fieldScope: FormFieldScope.ATTENDEE,
          isRequired: true,
        }),
      ],
    }),
  },
  {
    templateKey: "system-camporee",
    name: "Camporee",
    description: "Camporee starter with club contacts, campsite setup, attendee participation prompts, and logistics notes for scoring follow-through.",
    eventMode: EventMode.CLUB_REGISTRATION,
    category: EventTemplateCategory.CLUB_REGISTRATION,
    snapshot: buildEventTemplateSnapshot({
      eventMode: EventMode.CLUB_REGISTRATION,
      workflowType: "CAMPOREE",
      name: "Camporee",
      description: "Large conference camporee starter paired with the guided Camporee registration workflow for campsite, travel, meal, safety, and ministry planning.",
      startsAt: new Date("2026-10-09T18:00:00.000Z"),
      endsAt: new Date("2026-10-11T19:00:00.000Z"),
      registrationOpensAt: new Date("2026-08-15T00:00:00.000Z"),
      registrationClosesAt: new Date("2026-09-20T00:00:00.000Z"),
      basePrice: 40,
      lateFeePrice: 55,
      lateFeeStartsAt: new Date("2026-09-10T00:00:00.000Z"),
      locationName: "Camporee Grounds",
      locationAddress: "456 Pathfinder Dr",
      dynamicFields: [
        templateGroup("camporee-contact-group", "camporee_contact", "Club Contact", "Primary contact details for campsite planning and competition communication."),
        templateField({
          id: "camporee-contact-name",
          parentFieldId: "camporee-contact-group",
          key: "camporee_contact_name",
          label: "Camporee contact name",
          description: "Lead adult handling camporee logistics for the club.",
          type: FormFieldType.SHORT_TEXT,
          isRequired: true,
        }),
        templateField({
          id: "camporee-contact-phone",
          parentFieldId: "camporee-contact-group",
          key: "camporee_contact_phone",
          label: "Camporee contact phone",
          description: "Best number for campsite and event coordination.",
          type: FormFieldType.SHORT_TEXT,
          isRequired: true,
        }),
        templateGroup("camporee-site-group", "camporee_site", "Campsite Setup", "Core setup details for assigning and reviewing camporee space."),
        templateField({
          id: "campsite-type",
          parentFieldId: "camporee-site-group",
          key: "campsite_type",
          label: "Campsite type",
          description: "Primary campsite style needed by the club.",
          type: FormFieldType.SINGLE_SELECT,
          isRequired: true,
          options: ["Primitive", "RV", "Cabin"],
        }),
        templateField({
          id: "tent-summary",
          parentFieldId: "camporee-site-group",
          key: "tent_summary",
          label: "Tent sizes and quantities",
          description: "List tents and approximate sizes for the campsite.",
          type: FormFieldType.LONG_TEXT,
          isRequired: true,
        }),
        templateField({
          id: "trailer-count",
          parentFieldId: "camporee-site-group",
          key: "trailer_count",
          label: "Trailer count",
          description: "Number of trailers or extra support vehicles needing space.",
          type: FormFieldType.NUMBER,
          isRequired: true,
        }),
        templateField({
          id: "kitchen-canopy",
          parentFieldId: "camporee-site-group",
          key: "kitchen_canopy",
          label: "Kitchen canopy planned",
          description: "Indicate whether the club will bring a kitchen canopy.",
          type: FormFieldType.BOOLEAN,
          isRequired: true,
        }),
        templateField({
          id: "square-footage",
          parentFieldId: "camporee-site-group",
          key: "square_footage_needed",
          label: "Estimated square footage needed",
          description: "Approximate footprint needed for tents, kitchen, and common space.",
          type: FormFieldType.NUMBER,
          isRequired: true,
        }),
        templateField({
          id: "camp-near-request",
          parentFieldId: "camporee-site-group",
          key: "camp_near_request",
          label: "Camp-near request",
          description: "Optional request to camp near another club or district.",
          type: FormFieldType.SHORT_TEXT,
        }),
        templateGroup("camporee-participation-group", "camporee_participation", "Participation Planning", "Starter questions that support roster selection and activity planning."),
        templateField({
          id: "duty-preferences",
          parentFieldId: "camporee-participation-group",
          key: "duty_preferences",
          label: "Duty or activity preferences",
          description: "Preferred camporee duty stations or activity areas.",
          type: FormFieldType.MULTI_SELECT,
          options: ["Drill", "First Aid", "Bible Experience", "Kitchen Duty", "Camp Setup", "Flag Team"],
        }),
        templateField({
          id: "team-interest",
          parentFieldId: "camporee-participation-group",
          key: "team_interest",
          label: "Preferred activity team",
          description: "Attendee-level preference for activity planning.",
          type: FormFieldType.SINGLE_SELECT,
          fieldScope: FormFieldScope.ATTENDEE,
          options: ["Drill Team", "First Aid", "Bible Experience", "Pioneering", "General Participation"],
        }),
        templateField({
          id: "camporee-skill-note",
          parentFieldId: "camporee-participation-group",
          key: "special_skill_note",
          label: "Special skill or duty note",
          description: "Optional attendee note for unique skills or duty assignment considerations.",
          type: FormFieldType.LONG_TEXT,
          fieldScope: FormFieldScope.ATTENDEE,
        }),
        templateGroup("camporee-logistics-group", "camporee_logistics", "Emergency and Logistics Notes", "Final coordination notes before campsite assignments are published."),
        templateField({
          id: "logistics-notes",
          parentFieldId: "camporee-logistics-group",
          key: "logistics_notes",
          label: "Emergency or logistics notes",
          description: "Medication storage, generator use, accessibility needs, or other logistics.",
          type: FormFieldType.LONG_TEXT,
        }),
      ],
    }),
  },
  {
    templateKey: "system-adventurer-fun-day",
    name: "Adventurer Fun Day",
    description: "Single-day Adventurer event starter with attendance counts, lunch planning, guardian coordination, and simple activity grouping.",
    eventMode: EventMode.CLUB_REGISTRATION,
    category: EventTemplateCategory.CLUB_REGISTRATION,
    snapshot: buildEventTemplateSnapshot({
      eventMode: EventMode.CLUB_REGISTRATION,
      name: "Adventurer Fun Day",
      description: "Single-day Adventurer event starter with family counts, lunch planning, emergency contact details, and light activity grouping.",
      startsAt: new Date("2026-05-02T15:00:00.000Z"),
      endsAt: new Date("2026-05-02T23:00:00.000Z"),
      registrationOpensAt: new Date("2026-04-01T00:00:00.000Z"),
      registrationClosesAt: new Date("2026-04-20T00:00:00.000Z"),
      basePrice: 15,
      lateFeePrice: 20,
      lateFeeStartsAt: new Date("2026-04-15T00:00:00.000Z"),
      locationName: "Adventurer Park",
      locationAddress: "789 Family Ln",
      dynamicFields: [
        templateGroup("fun-day-attendance-group", "fun_day_attendance", "Attendance Planning", "High-level club attendance counts for the day."),
        templateField({
          id: "child-count",
          parentFieldId: "fun-day-attendance-group",
          key: "child_count",
          label: "Child count",
          description: "Approximate number of Adventurers attending.",
          type: FormFieldType.NUMBER,
          isRequired: true,
        }),
        templateField({
          id: "adult-count",
          parentFieldId: "fun-day-attendance-group",
          key: "adult_count",
          label: "Adult count",
          description: "Number of adult sponsors and guardians attending.",
          type: FormFieldType.NUMBER,
          isRequired: true,
        }),
        templateField({
          id: "lunch-count",
          parentFieldId: "fun-day-attendance-group",
          key: "lunch_count",
          label: "Lunch count",
          description: "Total lunches requested for the club.",
          type: FormFieldType.NUMBER,
          isRequired: true,
        }),
        templateGroup("fun-day-care-group", "fun_day_care", "Guardian and Care Notes", "Parent, pickup, and care coordination for the event day."),
        templateField({
          id: "fun-day-emergency-contact",
          parentFieldId: "fun-day-care-group",
          key: "emergency_contact",
          label: "Emergency contact during event",
          description: "Best adult contact available during the day.",
          type: FormFieldType.SHORT_TEXT,
          isRequired: true,
        }),
        templateField({
          id: "pickup-notes",
          parentFieldId: "fun-day-care-group",
          key: "pickup_notes",
          label: "Pickup or guardian notes",
          description: "Important end-of-day pickup instructions or guardian notes.",
          type: FormFieldType.LONG_TEXT,
        }),
        templateField({
          id: "dietary-restrictions",
          parentFieldId: "fun-day-care-group",
          key: "dietary_restrictions",
          label: "Dietary restrictions",
          description: "Allergies or lunch restrictions for the club.",
          type: FormFieldType.LONG_TEXT,
        }),
        templateGroup("fun-day-activities-group", "fun_day_activities", "Activity Grouping", "Simple starter grouping for stations and age bands."),
        templateField({
          id: "activity-grouping",
          parentFieldId: "fun-day-activities-group",
          key: "activity_grouping",
          label: "Preferred activity grouping",
          description: "Primary age band or grouping for the club's participants.",
          type: FormFieldType.SINGLE_SELECT,
          options: ["Little Lamb / Early Bird", "Busy Bee / Sunbeam", "Builder / Helping Hand", "Mixed club grouping"],
        }),
        templateField({
          id: "child-group-note",
          parentFieldId: "fun-day-activities-group",
          key: "child_group_note",
          label: "Child grouping note",
          description: "Optional attendee note for pairing or grouping requests.",
          type: FormFieldType.SHORT_TEXT,
          fieldScope: FormFieldScope.ATTENDEE,
        }),
      ],
    }),
  },
  {
    templateKey: "system-tlt-registration",
    name: "TLT Registration",
    description: "TLT event starter with attendee-level track, grade, leadership interest, experience, and confirmation prompts plus club logistics notes.",
    eventMode: EventMode.CLUB_REGISTRATION,
    category: EventTemplateCategory.CLUB_REGISTRATION,
    snapshot: buildEventTemplateSnapshot({
      eventMode: EventMode.CLUB_REGISTRATION,
      name: "TLT Registration",
      description: "TLT event starter with attendee-level leadership details and club-level travel and housing notes.",
      startsAt: new Date("2026-06-12T22:00:00.000Z"),
      endsAt: new Date("2026-06-14T18:00:00.000Z"),
      registrationOpensAt: new Date("2026-05-01T00:00:00.000Z"),
      registrationClosesAt: new Date("2026-05-30T00:00:00.000Z"),
      basePrice: 25,
      lateFeePrice: 35,
      lateFeeStartsAt: new Date("2026-05-20T00:00:00.000Z"),
      locationName: "Leadership Center",
      locationAddress: "100 TLT Way",
      dynamicFields: [
        templateGroup("tlt-club-group", "tlt_club", "Club Logistics", "Housing and transportation notes for the club's TLT attendees."),
        templateField({
          id: "tlt-housing-notes",
          parentFieldId: "tlt-club-group",
          key: "housing_notes",
          label: "Housing notes",
          description: "Rooming requests, sponsor pairing, or housing concerns.",
          type: FormFieldType.LONG_TEXT,
        }),
        templateField({
          id: "tlt-transport-notes",
          parentFieldId: "tlt-club-group",
          key: "transport_notes",
          label: "Transportation notes",
          description: "Arrival, departure, or travel planning notes for the club.",
          type: FormFieldType.LONG_TEXT,
        }),
        templateGroup("tlt-attendee-group", "tlt_attendee", "Attendee Readiness", "Attendee-level leadership information for TLT planning."),
        templateField({
          id: "tlt-track",
          parentFieldId: "tlt-attendee-group",
          key: "tlt_track",
          label: "TLT Track",
          description: "Select the participant's current TLT level.",
          type: FormFieldType.SINGLE_SELECT,
          fieldScope: FormFieldScope.ATTENDEE,
          isRequired: true,
          options: ["TLT 1", "TLT 2", "TLT 3"],
        }),
        templateField({
          id: "tlt-grade-level",
          parentFieldId: "tlt-attendee-group",
          key: "grade_level",
          label: "Age or grade level",
          description: "Helpful for placement and housing review.",
          type: FormFieldType.SHORT_TEXT,
          fieldScope: FormFieldScope.ATTENDEE,
          isRequired: true,
        }),
        templateField({
          id: "tlt-prior-experience",
          parentFieldId: "tlt-attendee-group",
          key: "prior_experience",
          label: "Prior leadership or TLT experience",
          description: "Previous TLT years, leadership roles, or ministry experience.",
          type: FormFieldType.LONG_TEXT,
          fieldScope: FormFieldScope.ATTENDEE,
        }),
        templateField({
          id: "tlt-leadership-interest",
          parentFieldId: "tlt-attendee-group",
          key: "leadership_interest",
          label: "Leadership interest areas",
          description: "Areas where the attendee hopes to grow or serve.",
          type: FormFieldType.MULTI_SELECT,
          fieldScope: FormFieldScope.ATTENDEE,
          options: ["Worship", "Drill", "Teaching", "Outreach", "Audio/Visual", "Event Support"],
        }),
        templateField({
          id: "tlt-guardian-confirmation",
          parentFieldId: "tlt-attendee-group",
          key: "guardian_confirmation",
          label: "Guardian confirmation received",
          description: "Confirm that parent or guardian approval is on file.",
          type: FormFieldType.BOOLEAN,
          fieldScope: FormFieldScope.ATTENDEE,
          isRequired: true,
        }),
        templateField({
          id: "tlt-staff-confirmation",
          parentFieldId: "tlt-attendee-group",
          key: "staff_confirmation",
          label: "Club director or staff confirmation completed",
          description: "Confirm the club leadership team reviewed this attendee's participation.",
          type: FormFieldType.BOOLEAN,
          fieldScope: FormFieldScope.ATTENDEE,
          isRequired: true,
        }),
      ],
    }),
  },
  {
    templateKey: "system-staff-teacher-registration",
    name: "Staff / Teacher Registration",
    description: "Staffing starter with counts, role breakdown, meals, housing, arrival details, and compliance confirmations.",
    eventMode: EventMode.BASIC_FORM,
    category: EventTemplateCategory.BASIC_EVENTS,
    snapshot: buildEventTemplateSnapshot({
      eventMode: EventMode.BASIC_FORM,
      name: "Staff / Teacher Registration",
      description: "Basic-form staffing starter for teacher, staff, and support-team coordination without roster attendee selection.",
      startsAt: new Date("2026-07-10T14:00:00.000Z"),
      endsAt: new Date("2026-07-10T22:00:00.000Z"),
      registrationOpensAt: new Date("2026-06-01T00:00:00.000Z"),
      registrationClosesAt: new Date("2026-06-25T00:00:00.000Z"),
      basePrice: 0,
      lateFeePrice: 0,
      lateFeeStartsAt: new Date("2026-06-20T00:00:00.000Z"),
      locationName: "Conference Office",
      locationAddress: "200 Admin Ave",
      dynamicFields: [
        templateGroup("staffing-group", "staffing_plan", "Staffing Plan", "High-level staffing counts and assignment notes."),
        templateField({
          id: "staff-count",
          parentFieldId: "staffing-group",
          key: "staff_count",
          label: "How many staff members will attend?",
          description: "Total number of staff or teachers expected.",
          type: FormFieldType.NUMBER,
          isRequired: true,
        }),
        templateField({
          id: "role-breakdown",
          parentFieldId: "staffing-group",
          key: "role_department_breakdown",
          label: "Role or department breakdown",
          description: "Summarize teaching, worship, logistics, health, AV, or support assignments.",
          type: FormFieldType.LONG_TEXT,
          isRequired: true,
        }),
        templateGroup("staffing-logistics-group", "staffing_logistics", "Housing and Meals", "Starter planning for lodging and meal service."),
        templateField({
          id: "housing-needs",
          parentFieldId: "staffing-logistics-group",
          key: "housing_needs",
          label: "Housing needs",
          description: "Rooming requests, shared housing, or no-housing-needed notes.",
          type: FormFieldType.LONG_TEXT,
        }),
        templateField({
          id: "breakfast-meal-count",
          parentFieldId: "staffing-logistics-group",
          key: "breakfast_meal_count",
          label: "Breakfast meal count",
          description: "Breakfasts needed for the team.",
          type: FormFieldType.NUMBER,
          isRequired: true,
        }),
        templateField({
          id: "lunch-meal-count",
          parentFieldId: "staffing-logistics-group",
          key: "lunch_meal_count",
          label: "Lunch meal count",
          description: "Lunches needed for the team.",
          type: FormFieldType.NUMBER,
          isRequired: true,
        }),
        templateField({
          id: "supper-meal-count",
          parentFieldId: "staffing-logistics-group",
          key: "supper_meal_count",
          label: "Supper meal count",
          description: "Suppers needed for the team.",
          type: FormFieldType.NUMBER,
          isRequired: true,
        }),
        templateGroup("staffing-travel-group", "staffing_travel", "Travel and Compliance", "Arrival timing and readiness confirmations for the staff team."),
        templateField({
          id: "arrival-plan",
          parentFieldId: "staffing-travel-group",
          key: "arrival_plan",
          label: "Arrival plan",
          description: "Expected arrival time or arrival coordination notes.",
          type: FormFieldType.SHORT_TEXT,
          isRequired: true,
        }),
        templateField({
          id: "departure-plan",
          parentFieldId: "staffing-travel-group",
          key: "departure_plan",
          label: "Departure plan",
          description: "Expected departure timing for the team.",
          type: FormFieldType.SHORT_TEXT,
          isRequired: true,
        }),
        templateField({
          id: "compliance-confirmation",
          parentFieldId: "staffing-travel-group",
          key: "compliance_confirmation",
          label: "Required compliance items confirmed",
          description: "Confirm background checks or conference clearances are complete as applicable.",
          type: FormFieldType.BOOLEAN,
          isRequired: true,
        }),
        templateField({
          id: "staff-emergency-contact",
          parentFieldId: "staffing-travel-group",
          key: "staff_emergency_contact",
          label: "Emergency contact on site",
          description: "Lead staff contact during the event.",
          type: FormFieldType.SHORT_TEXT,
          isRequired: true,
        }),
      ],
    }),
  },
  {
    templateKey: "system-generic-conference-event",
    name: "Generic Conference Event",
    description: "General-purpose conference event starter with club contacts, attendee notes, emergency planning, dietary needs, and acknowledgement prompts.",
    eventMode: EventMode.CLUB_REGISTRATION,
    category: EventTemplateCategory.BASIC_EVENTS,
    snapshot: buildEventTemplateSnapshot({
      eventMode: EventMode.CLUB_REGISTRATION,
      name: "Generic Conference Event",
      description: "General-purpose conference event starter with useful default prompts for contacts, attendee planning, and operational notes.",
      startsAt: new Date("2026-11-06T18:00:00.000Z"),
      endsAt: new Date("2026-11-08T20:00:00.000Z"),
      registrationOpensAt: new Date("2026-10-01T00:00:00.000Z"),
      registrationClosesAt: new Date("2026-10-25T00:00:00.000Z"),
      basePrice: 20,
      lateFeePrice: 30,
      lateFeeStartsAt: new Date("2026-10-18T00:00:00.000Z"),
      locationName: "Conference Venue",
      locationAddress: "300 Event Blvd",
      dynamicFields: [
        templateGroup("generic-contact-group", "generic_contact", "Club Contact", "Primary registration contacts and event acknowledgements."),
        templateField({
          id: "generic-contact-name",
          parentFieldId: "generic-contact-group",
          key: "primary_contact_name",
          label: "Primary contact name",
          description: "Lead adult coordinating the club registration.",
          type: FormFieldType.SHORT_TEXT,
          isRequired: true,
        }),
        templateField({
          id: "generic-contact-phone",
          parentFieldId: "generic-contact-group",
          key: "primary_contact_phone",
          label: "Primary contact phone",
          description: "Best number for event follow-up.",
          type: FormFieldType.SHORT_TEXT,
          isRequired: true,
        }),
        templateField({
          id: "generic-ack",
          parentFieldId: "generic-contact-group",
          key: "event_acknowledgement",
          label: "Event requirements reviewed with the club",
          description: "Starter acknowledgement for announcements, expectations, and deadlines.",
          type: FormFieldType.BOOLEAN,
          isRequired: true,
        }),
        templateGroup("generic-planning-group", "generic_planning", "Planning Notes", "Starter questions for emergency, dietary, and general registration notes."),
        templateField({
          id: "generic-emergency-contact",
          parentFieldId: "generic-planning-group",
          key: "emergency_contact_on_site",
          label: "Emergency contact on site",
          description: "Adult contact available during the event.",
          type: FormFieldType.SHORT_TEXT,
          isRequired: true,
        }),
        templateField({
          id: "generic-dietary-notes",
          parentFieldId: "generic-planning-group",
          key: "dietary_notes",
          label: "Dietary restrictions or meal notes",
          description: "Food allergy or meal-planning notes for the club.",
          type: FormFieldType.LONG_TEXT,
        }),
        templateField({
          id: "generic-club-notes",
          parentFieldId: "generic-planning-group",
          key: "club_notes",
          label: "Additional club notes",
          description: "Any general notes that should appear with the registration.",
          type: FormFieldType.LONG_TEXT,
        }),
        templateGroup("generic-attendee-group", "generic_attendee", "Attendee Basics", "Helpful attendee-level notes for a broad range of conference events."),
        templateField({
          id: "generic-accommodation",
          parentFieldId: "generic-attendee-group",
          key: "special_accommodation",
          label: "Accommodation or accessibility notes",
          description: "Optional attendee-level note for accessibility or support needs.",
          type: FormFieldType.LONG_TEXT,
          fieldScope: FormFieldScope.ATTENDEE,
        }),
        templateField({
          id: "generic-attendee-dietary",
          parentFieldId: "generic-attendee-group",
          key: "attendee_dietary_note",
          label: "Dietary note",
          description: "Optional attendee-level dietary note.",
          type: FormFieldType.SHORT_TEXT,
          fieldScope: FormFieldScope.ATTENDEE,
        }),
      ],
    }),
  },
  {
    templateKey: "system-pathfinder-monthly-report",
    name: "Pathfinder Monthly Report",
    description: "Monthly report starter aligned to the existing CMMS reporting workflow, including report month, attendance metrics, uniform compliance, and leadership notes.",
    eventMode: EventMode.BASIC_FORM,
    category: EventTemplateCategory.MONTHLY_REPORTS,
    snapshot: buildEventTemplateSnapshot({
      eventMode: EventMode.BASIC_FORM,
      name: "Pathfinder Monthly Report",
      description: "Report-style starter aligned to the existing monthly report workflow for meeting counts, attendance, uniform compliance, and summary notes.",
      startsAt: new Date("2026-03-01T00:00:00.000Z"),
      endsAt: new Date("2026-03-31T23:59:00.000Z"),
      registrationOpensAt: new Date("2026-03-01T00:00:00.000Z"),
      registrationClosesAt: new Date("2026-04-10T23:59:00.000Z"),
      basePrice: 0,
      lateFeePrice: 0,
      lateFeeStartsAt: new Date("2026-04-01T00:00:00.000Z"),
      locationName: "Conference Reporting",
      locationAddress: "Digital Submission",
      dynamicFields: [
        templateGroup("monthly-report-period-group", "monthly_report_period", "Reporting Period", "Core reporting period fields aligned to the current monthly report workflow."),
        templateField({
          id: "report-month",
          parentFieldId: "monthly-report-period-group",
          key: "report_month_label",
          label: "Report month",
          description: "Use YYYY-MM format to match the current reporting process.",
          type: FormFieldType.SHORT_TEXT,
          isRequired: true,
        }),
        templateField({
          id: "meeting-count",
          parentFieldId: "monthly-report-period-group",
          key: "meeting_count",
          label: "Meeting count",
          description: "Total Pathfinder meetings held during the month.",
          type: FormFieldType.NUMBER,
          isRequired: true,
        }),
        templateGroup("monthly-report-metrics-group", "monthly_report_metrics", "Attendance Metrics", "Numeric inputs that mirror the existing reporting rubric."),
        templateField({
          id: "avg-pathfinder-attendance",
          parentFieldId: "monthly-report-metrics-group",
          key: "average_pathfinder_attendance",
          label: "Average Pathfinder attendance",
          description: "Average number of Pathfinders present across meetings.",
          type: FormFieldType.NUMBER,
          isRequired: true,
        }),
        templateField({
          id: "avg-staff-attendance",
          parentFieldId: "monthly-report-metrics-group",
          key: "average_staff_attendance",
          label: "Average staff attendance",
          description: "Average number of staff present across meetings.",
          type: FormFieldType.NUMBER,
          isRequired: true,
        }),
        templateField({
          id: "uniform-compliance",
          parentFieldId: "monthly-report-metrics-group",
          key: "uniform_compliance",
          label: "Uniform compliance percentage",
          description: "Percentage of members in proper uniform, from 0 to 100.",
          type: FormFieldType.NUMBER,
          isRequired: true,
        }),
        templateGroup("monthly-report-notes-group", "monthly_report_notes", "Leadership Notes", "Optional highlights and support notes that are commonly needed alongside the metrics."),
        templateField({
          id: "monthly-highlights",
          parentFieldId: "monthly-report-notes-group",
          key: "monthly_highlights",
          label: "Monthly highlights",
          description: "Key achievements, outreach wins, or notable club moments.",
          type: FormFieldType.LONG_TEXT,
        }),
        templateField({
          id: "monthly-challenges",
          parentFieldId: "monthly-report-notes-group",
          key: "monthly_challenges",
          label: "Challenges or support needed",
          description: "Areas where the club needs follow-up or support from the conference.",
          type: FormFieldType.LONG_TEXT,
        }),
        templateField({
          id: "next-month-focus",
          parentFieldId: "monthly-report-notes-group",
          key: "next_month_focus",
          label: "Next month focus",
          description: "Main priorities for the upcoming month.",
          type: FormFieldType.LONG_TEXT,
        }),
        templateField({
          id: "monthly-report-ack",
          parentFieldId: "monthly-report-notes-group",
          key: "report_accuracy_acknowledgement",
          label: "I confirm these numbers align with our club activity records",
          description: "Starter acknowledgement before submitting the monthly report.",
          type: FormFieldType.BOOLEAN,
          isRequired: true,
        }),
      ],
    }),
  },
] as const;

async function seedSuperAdmin() {
  const passwordHash = await bcrypt.hash(DEFAULT_SUPER_ADMIN_PASSWORD, 12);

  const superAdmin = await prisma.user.upsert({
    where: {
      email: DEFAULT_SUPER_ADMIN_EMAIL,
    },
    update: {
      name: DEFAULT_SUPER_ADMIN_NAME,
      role: UserRole.SUPER_ADMIN,
      passwordHash,
    },
    create: {
      email: DEFAULT_SUPER_ADMIN_EMAIL,
      name: DEFAULT_SUPER_ADMIN_NAME,
      role: UserRole.SUPER_ADMIN,
      passwordHash,
    },
  });

  return superAdmin;
}

function getCurrentRosterYear() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const startsOn = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  const endsOn = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

  return {
    yearLabel: `${year}`,
    startsOn,
    endsOn,
  };
}

async function seedDefaultClub() {
  const club = await prisma.club.upsert({
    where: {
      code: DEFAULT_CLUB_CODE,
    },
    update: {
      name: "Conference Testing Club",
      type: "PATHFINDER",
      city: "Testing City",
      state: "TS",
    },
    create: {
      name: "Conference Testing Club",
      code: DEFAULT_CLUB_CODE,
      type: "PATHFINDER",
      city: "Testing City",
      state: "TS",
    },
  });

  const rosterYear = getCurrentRosterYear();

  await prisma.clubRosterYear.upsert({
    where: {
      clubId_yearLabel: {
        clubId: club.id,
        yearLabel: rosterYear.yearLabel,
      },
    },
    update: {
      startsOn: rosterYear.startsOn,
      endsOn: rosterYear.endsOn,
      isActive: true,
    },
    create: {
      clubId: club.id,
      yearLabel: rosterYear.yearLabel,
      startsOn: rosterYear.startsOn,
      endsOn: rosterYear.endsOn,
      isActive: true,
    },
  });

  return club;
}

async function seedHonors() {
  for (const honor of DEFAULT_HONORS) {
    await prisma.classCatalog.upsert({
      where: {
        code: honor.code,
      },
      update: {
        title: honor.title,
        description: honor.description,
        classType: ClassType.HONOR,
        active: true,
        requirements: {
          deleteMany: {},
          create: honor.requirements,
        },
      },
      create: {
        code: honor.code,
        title: honor.title,
        description: honor.description,
        classType: ClassType.HONOR,
        active: true,
        requirements: {
          create: honor.requirements,
        },
      },
    });
  }
}

async function seedOfficialEventTemplates(superAdminId: string) {
  for (const template of OFFICIAL_EVENT_TEMPLATES) {
    await prisma.eventTemplate.upsert({
      where: {
        templateKey: template.templateKey,
      },
      update: {
        name: template.name,
        description: template.description,
        eventMode: template.eventMode,
        category: template.category,
        source: EventTemplateSource.SYSTEM,
        isActive: true,
        archivedAt: null,
        snapshot: template.snapshot,
        createdByUserId: superAdminId,
      },
      create: {
        templateKey: template.templateKey,
        name: template.name,
        description: template.description,
        eventMode: template.eventMode,
        category: template.category,
        source: EventTemplateSource.SYSTEM,
        isActive: true,
        archivedAt: null,
        snapshot: template.snapshot,
        createdByUserId: superAdminId,
      },
    });
  }
}

async function main() {
  const superAdmin = await seedSuperAdmin();
  const club = await seedDefaultClub();
  await seedHonors();
  await seedOfficialEventTemplates(superAdmin.id);

  console.log("Seed complete:");
  console.log(`- Super Admin: ${superAdmin.email}`);
  console.log(`- Club: ${club.name} (${club.code})`);
  console.log(`- Honors seeded: ${DEFAULT_HONORS.length}`);
  console.log(`- Official event templates seeded: ${OFFICIAL_EVENT_TEMPLATES.length}`);
}

main()
  .catch((error) => {
    console.error("Seeding failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
