import { MonthlyReportStatus, type MonthlyReport, type MonthlyReportScoreLineItem } from "@prisma/client";

export const MONTHLY_REPORT_SCORE_CONFIG = {
  staffMeeting: 15,
  meetingOutingUnit: 20,
  meetingOutingMax: 80,
  averageAttendanceUnit: 1,
  averageAttendanceMax: 60,
  pathfinderCountUnit: 1,
  pathfinderCountMax: 60,
  tltCountUnit: 2,
  tltCountMax: 20,
  staffCountUnit: 2,
  staffCountMax: 24,
  uniformComplianceMax: 100,
  guestHelperUnit: 2,
  guestHelperMax: 20,
  honorParticipantUnit: 1,
  honorParticipantMax: 30,
  narrativeCompletion: 10,
  bonusMax: 30,
} as const;

export type MonthlyReportScoreLineItemInput = {
  key: string;
  label: string;
  points: number;
  maxPoints: number;
  sortOrder: number;
  notes?: string | null;
};

export type MonthlyReportScoringInput = {
  averageAttendance: number;
  pathfinderCount: number;
  tltCount: number;
  staffCount: number;
  staffMeetingHeld: boolean;
  meetingOutingCount: number;
  devotionsEmphasis?: string | null;
  exercisePromotion?: string | null;
  outreachActivities?: string | null;
  guestHelperCount: number;
  uniformCompliance: number;
  honorWorkSummary?: string | null;
  honorParticipantCount: number;
  bonusNotes?: string | null;
};

function capPoints(value: number, max: number) {
  return Math.min(Math.max(value, 0), max);
}

function narrativePoints(value?: string | null) {
  return value && value.trim().length > 0 ? MONTHLY_REPORT_SCORE_CONFIG.narrativeCompletion : 0;
}

export function buildMonthlyReportScoreLineItems(
  input: MonthlyReportScoringInput,
): MonthlyReportScoreLineItemInput[] {
  const lineItems: MonthlyReportScoreLineItemInput[] = [
    {
      key: "staff_meeting",
      label: "Staff meeting held",
      points: input.staffMeetingHeld ? MONTHLY_REPORT_SCORE_CONFIG.staffMeeting : 0,
      maxPoints: MONTHLY_REPORT_SCORE_CONFIG.staffMeeting,
      sortOrder: 1,
    },
    {
      key: "meetings_outings",
      label: "Meetings and outings",
      points: capPoints(
        input.meetingOutingCount * MONTHLY_REPORT_SCORE_CONFIG.meetingOutingUnit,
        MONTHLY_REPORT_SCORE_CONFIG.meetingOutingMax,
      ),
      maxPoints: MONTHLY_REPORT_SCORE_CONFIG.meetingOutingMax,
      sortOrder: 2,
    },
    {
      key: "average_attendance",
      label: "Average attendance",
      points: capPoints(
        input.averageAttendance * MONTHLY_REPORT_SCORE_CONFIG.averageAttendanceUnit,
        MONTHLY_REPORT_SCORE_CONFIG.averageAttendanceMax,
      ),
      maxPoints: MONTHLY_REPORT_SCORE_CONFIG.averageAttendanceMax,
      sortOrder: 3,
    },
    {
      key: "pathfinder_count",
      label: "Pathfinder membership",
      points: capPoints(
        input.pathfinderCount * MONTHLY_REPORT_SCORE_CONFIG.pathfinderCountUnit,
        MONTHLY_REPORT_SCORE_CONFIG.pathfinderCountMax,
      ),
      maxPoints: MONTHLY_REPORT_SCORE_CONFIG.pathfinderCountMax,
      sortOrder: 4,
    },
    {
      key: "tlt_count",
      label: "TLT participation",
      points: capPoints(
        input.tltCount * MONTHLY_REPORT_SCORE_CONFIG.tltCountUnit,
        MONTHLY_REPORT_SCORE_CONFIG.tltCountMax,
      ),
      maxPoints: MONTHLY_REPORT_SCORE_CONFIG.tltCountMax,
      sortOrder: 5,
    },
    {
      key: "staff_count",
      label: "Staff support",
      points: capPoints(
        input.staffCount * MONTHLY_REPORT_SCORE_CONFIG.staffCountUnit,
        MONTHLY_REPORT_SCORE_CONFIG.staffCountMax,
      ),
      maxPoints: MONTHLY_REPORT_SCORE_CONFIG.staffCountMax,
      sortOrder: 6,
    },
    {
      key: "uniform_compliance",
      label: "Uniform compliance",
      points: capPoints(input.uniformCompliance, MONTHLY_REPORT_SCORE_CONFIG.uniformComplianceMax),
      maxPoints: MONTHLY_REPORT_SCORE_CONFIG.uniformComplianceMax,
      sortOrder: 7,
    },
    {
      key: "devotions",
      label: "Devotions emphasis",
      points: narrativePoints(input.devotionsEmphasis),
      maxPoints: MONTHLY_REPORT_SCORE_CONFIG.narrativeCompletion,
      sortOrder: 8,
      notes: input.devotionsEmphasis,
    },
    {
      key: "exercise",
      label: "Exercise promotion",
      points: narrativePoints(input.exercisePromotion),
      maxPoints: MONTHLY_REPORT_SCORE_CONFIG.narrativeCompletion,
      sortOrder: 9,
      notes: input.exercisePromotion,
    },
    {
      key: "outreach",
      label: "Outreach and ministry",
      points: narrativePoints(input.outreachActivities),
      maxPoints: MONTHLY_REPORT_SCORE_CONFIG.narrativeCompletion,
      sortOrder: 10,
      notes: input.outreachActivities,
    },
    {
      key: "guest_helpers",
      label: "Guest helpers",
      points: capPoints(
        input.guestHelperCount * MONTHLY_REPORT_SCORE_CONFIG.guestHelperUnit,
        MONTHLY_REPORT_SCORE_CONFIG.guestHelperMax,
      ),
      maxPoints: MONTHLY_REPORT_SCORE_CONFIG.guestHelperMax,
      sortOrder: 11,
    },
    {
      key: "honor_work",
      label: "Honor work participation",
      points: capPoints(
        input.honorParticipantCount * MONTHLY_REPORT_SCORE_CONFIG.honorParticipantUnit,
        MONTHLY_REPORT_SCORE_CONFIG.honorParticipantMax,
      ),
      maxPoints: MONTHLY_REPORT_SCORE_CONFIG.honorParticipantMax,
      sortOrder: 12,
      notes: input.honorWorkSummary,
    },
    {
      key: "bonus",
      label: "Bonus items",
      points: input.bonusNotes && input.bonusNotes.trim().length > 0 ? MONTHLY_REPORT_SCORE_CONFIG.bonusMax : 0,
      maxPoints: MONTHLY_REPORT_SCORE_CONFIG.bonusMax,
      sortOrder: 13,
      notes: input.bonusNotes,
    },
  ];

  return lineItems;
}

export function calculateMonthlyReportTotalScore(input: MonthlyReportScoringInput) {
  return buildMonthlyReportScoreLineItems(input).reduce((total, item) => total + item.points, 0);
}

export function formatMonthlyReportStatus(status: MonthlyReportStatus) {
  switch (status) {
    case MonthlyReportStatus.DRAFT:
      return "Draft";
    case MonthlyReportStatus.SUBMITTED:
      return "Submitted";
    case MonthlyReportStatus.UNDER_REVIEW:
      return "Under Review";
    case MonthlyReportStatus.APPROVED:
      return "Approved";
    case MonthlyReportStatus.REVISION_REQUESTED:
      return "Revision Requested";
    default:
      return status;
  }
}

export function isMonthlyReportEditable(status: MonthlyReportStatus) {
  return status === MonthlyReportStatus.DRAFT || status === MonthlyReportStatus.REVISION_REQUESTED;
}

export type MonthlyReportWithScoreItems = MonthlyReport & {
  scoreLineItems: MonthlyReportScoreLineItem[];
};
