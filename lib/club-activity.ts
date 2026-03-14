type ActivitySummaryInput = {
  pathfinderAttendance: number;
  staffAttendance: number;
  uniformCompliance: number;
};

type ExistingReportInput = {
  meetingOutingCount: number;
  averageAttendance: number;
  averagePathfinderAttendance: number;
  averageTltAttendance: number;
  averageStaffAttendance: number;
  pathfinderCount: number;
  tltCount: number;
  staffCount: number;
  uniformCompliance: number;
  meetingDay: string | null;
  meetingTime: string | null;
  meetingLocation: string | null;
  staffMeetingHeld: boolean;
  devotionsEmphasis: string | null;
  exercisePromotion: string | null;
  outreachActivities: string | null;
  guestHelperCount: number;
  uniformNotes: string | null;
  honorWorkSummary: string | null;
  honorParticipantCount: number;
  bonusNotes: string | null;
  submittedByName: string | null;
} | null;

export type MonthlyReportFormValues = {
  meetingDay: string;
  meetingTime: string;
  meetingLocation: string;
  averageAttendance: number;
  averagePathfinderAttendance: number;
  averageTltAttendance: number;
  averageStaffAttendance: number;
  pathfinderCount: number;
  tltCount: number;
  staffCount: number;
  staffMeetingHeld: boolean;
  meetingOutingCount: number;
  devotionsEmphasis: string;
  exercisePromotion: string;
  outreachActivities: string;
  guestHelperCount: number;
  uniformCompliance: number;
  uniformNotes: string;
  honorWorkSummary: string;
  honorParticipantCount: number;
  bonusNotes: string;
  submittedByName: string;
};

export type ClubActivityAutoFill = MonthlyReportFormValues & {
  activityCount: number;
};

function roundAverage(total: number, count: number) {
  if (count === 0) {
    return 0;
  }

  return Math.round(total / count);
}

export function parseMonthInput(value?: string | null) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) {
    const now = new Date();

    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  }

  const [yearPart, monthPart] = value.split("-");
  const year = Number.parseInt(yearPart, 10);
  const month = Number.parseInt(monthPart, 10);

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new Error("Month input is invalid.");
  }

  return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
}

export function getMonthWindow(monthStart: Date) {
  return {
    monthStart,
    monthEndExclusive: new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1, 0, 0, 0, 0)),
  };
}

export function formatMonthInputValue(value: Date) {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

export function formatDateInputValue(value: Date) {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function buildClubActivityAutoFill(activities: ActivitySummaryInput[]): ClubActivityAutoFill {
  if (activities.length === 0) {
    return {
      activityCount: 0,
      meetingDay: "",
      meetingTime: "",
      meetingLocation: "",
      averageAttendance: 0,
      averagePathfinderAttendance: 0,
      averageTltAttendance: 0,
      averageStaffAttendance: 0,
      pathfinderCount: 0,
      tltCount: 0,
      staffCount: 0,
      staffMeetingHeld: false,
      meetingOutingCount: 0,
      devotionsEmphasis: "",
      exercisePromotion: "",
      outreachActivities: "",
      guestHelperCount: 0,
      uniformCompliance: 0,
      uniformNotes: "",
      honorWorkSummary: "",
      honorParticipantCount: 0,
      bonusNotes: "",
      submittedByName: "",
    };
  }

  const totals = activities.reduce(
    (accumulator, activity) => ({
      pathfinders: accumulator.pathfinders + activity.pathfinderAttendance,
      staff: accumulator.staff + activity.staffAttendance,
      uniformCompliance: accumulator.uniformCompliance + activity.uniformCompliance,
    }),
    {
      pathfinders: 0,
      staff: 0,
      uniformCompliance: 0,
    },
  );

  return {
    activityCount: activities.length,
    meetingDay: "",
    meetingTime: "",
    meetingLocation: "",
    averageAttendance: roundAverage(totals.pathfinders + totals.staff, activities.length),
    averagePathfinderAttendance: roundAverage(totals.pathfinders, activities.length),
    averageTltAttendance: 0,
    averageStaffAttendance: roundAverage(totals.staff, activities.length),
    pathfinderCount: roundAverage(totals.pathfinders, activities.length),
    tltCount: 0,
    staffCount: roundAverage(totals.staff, activities.length),
    staffMeetingHeld: false,
    meetingOutingCount: activities.length,
    devotionsEmphasis: "",
    exercisePromotion: "",
    outreachActivities: "",
    guestHelperCount: 0,
    uniformCompliance: roundAverage(totals.uniformCompliance, activities.length),
    uniformNotes: "",
    honorWorkSummary: "",
    honorParticipantCount: 0,
    bonusNotes: "",
    submittedByName: "",
  };
}

export function buildMonthlyReportFormValues(
  existingReport: ExistingReportInput,
  autoFill: ClubActivityAutoFill,
): MonthlyReportFormValues {
  if (existingReport) {
    return {
      meetingDay: existingReport.meetingDay ?? "",
      meetingTime: existingReport.meetingTime ?? "",
      meetingLocation: existingReport.meetingLocation ?? "",
      averageAttendance: existingReport.averageAttendance,
      averagePathfinderAttendance: existingReport.averagePathfinderAttendance,
      averageTltAttendance: existingReport.averageTltAttendance,
      averageStaffAttendance: existingReport.averageStaffAttendance,
      pathfinderCount: existingReport.pathfinderCount,
      tltCount: existingReport.tltCount,
      staffCount: existingReport.staffCount,
      staffMeetingHeld: existingReport.staffMeetingHeld,
      meetingOutingCount: existingReport.meetingOutingCount,
      devotionsEmphasis: existingReport.devotionsEmphasis ?? "",
      exercisePromotion: existingReport.exercisePromotion ?? "",
      outreachActivities: existingReport.outreachActivities ?? "",
      guestHelperCount: existingReport.guestHelperCount,
      uniformCompliance: existingReport.uniformCompliance,
      uniformNotes: existingReport.uniformNotes ?? "",
      honorWorkSummary: existingReport.honorWorkSummary ?? "",
      honorParticipantCount: existingReport.honorParticipantCount,
      bonusNotes: existingReport.bonusNotes ?? "",
      submittedByName: existingReport.submittedByName ?? "",
    };
  }

  return {
    meetingDay: autoFill.meetingDay,
    meetingTime: autoFill.meetingTime,
    meetingLocation: autoFill.meetingLocation,
    averageAttendance: autoFill.averageAttendance,
    averagePathfinderAttendance: autoFill.averagePathfinderAttendance,
    averageTltAttendance: autoFill.averageTltAttendance,
    averageStaffAttendance: autoFill.averageStaffAttendance,
    pathfinderCount: autoFill.pathfinderCount,
    tltCount: autoFill.tltCount,
    staffCount: autoFill.staffCount,
    staffMeetingHeld: autoFill.staffMeetingHeld,
    meetingOutingCount: autoFill.meetingOutingCount,
    devotionsEmphasis: autoFill.devotionsEmphasis,
    exercisePromotion: autoFill.exercisePromotion,
    outreachActivities: autoFill.outreachActivities,
    guestHelperCount: autoFill.guestHelperCount,
    uniformCompliance: autoFill.uniformCompliance,
    uniformNotes: autoFill.uniformNotes,
    honorWorkSummary: autoFill.honorWorkSummary,
    honorParticipantCount: autoFill.honorParticipantCount,
    bonusNotes: autoFill.bonusNotes,
    submittedByName: autoFill.submittedByName,
  };
}
