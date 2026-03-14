import test from "node:test";
import assert from "node:assert/strict";

import {
  buildClubActivityAutoFill,
  buildMonthlyReportFormValues,
  formatMonthInputValue,
  getMonthWindow,
  parseMonthInput,
} from "../lib/club-activity";

test("club activity auto-fill converts logged activities into monthly report values", () => {
  const autoFill = buildClubActivityAutoFill([
    {
      pathfinderAttendance: 18,
      staffAttendance: 5,
      uniformCompliance: 92,
    },
    {
      pathfinderAttendance: 22,
      staffAttendance: 4,
      uniformCompliance: 88,
    },
    {
      pathfinderAttendance: 20,
      staffAttendance: 6,
      uniformCompliance: 90,
    },
  ]);

  assert.deepEqual(autoFill, {
    activityCount: 3,
    meetingDay: "",
    meetingTime: "",
    meetingLocation: "",
    averageAttendance: 25,
    averagePathfinderAttendance: 20,
    averageTltAttendance: 0,
    averageStaffAttendance: 5,
    pathfinderCount: 20,
    tltCount: 0,
    staffCount: 5,
    staffMeetingHeld: false,
    meetingOutingCount: 3,
    devotionsEmphasis: "",
    exercisePromotion: "",
    outreachActivities: "",
    guestHelperCount: 0,
    uniformCompliance: 90,
    uniformNotes: "",
    honorWorkSummary: "",
    honorParticipantCount: 0,
    bonusNotes: "",
    submittedByName: "",
  });
});

test("existing monthly report values override auto-fill defaults when editing a saved report", () => {
  const autoFill = buildClubActivityAutoFill([
    {
      pathfinderAttendance: 18,
      staffAttendance: 5,
      uniformCompliance: 92,
    },
  ]);

  const formValues = buildMonthlyReportFormValues(
    {
      meetingOutingCount: 4,
      averageAttendance: 32,
      averagePathfinderAttendance: 25,
      averageTltAttendance: 2,
      averageStaffAttendance: 7,
      pathfinderCount: 30,
      tltCount: 2,
      staffCount: 8,
      meetingDay: "Wednesday",
      meetingTime: "7:00 PM",
      meetingLocation: "Fellowship Hall",
      staffMeetingHeld: true,
      devotionsEmphasis: "Prayer and worship",
      exercisePromotion: "Club drill",
      outreachActivities: "Community service visit",
      guestHelperCount: 3,
      uniformCompliance: 96,
      uniformNotes: "Two members absent in uniform.",
      honorWorkSummary: "First Aid honor rotation",
      honorParticipantCount: 12,
      bonusNotes: "Hosted federation drill day",
      submittedByName: "Director Jones",
    },
    autoFill,
  );

  assert.deepEqual(formValues, {
    meetingDay: "Wednesday",
    meetingTime: "7:00 PM",
    meetingLocation: "Fellowship Hall",
    averageAttendance: 32,
    averagePathfinderAttendance: 25,
    averageTltAttendance: 2,
    averageStaffAttendance: 7,
    pathfinderCount: 30,
    tltCount: 2,
    staffCount: 8,
    staffMeetingHeld: true,
    meetingOutingCount: 4,
    devotionsEmphasis: "Prayer and worship",
    exercisePromotion: "Club drill",
    outreachActivities: "Community service visit",
    guestHelperCount: 3,
    uniformCompliance: 96,
    uniformNotes: "Two members absent in uniform.",
    honorWorkSummary: "First Aid honor rotation",
    honorParticipantCount: 12,
    bonusNotes: "Hosted federation drill day",
    submittedByName: "Director Jones",
  });
});

test("month helpers normalize month selection into a stable UTC reporting window", () => {
  const monthStart = parseMonthInput("2026-04");
  const { monthEndExclusive } = getMonthWindow(monthStart);

  assert.equal(formatMonthInputValue(monthStart), "2026-04");
  assert.equal(monthStart.toISOString(), "2026-04-01T00:00:00.000Z");
  assert.equal(monthEndExclusive.toISOString(), "2026-05-01T00:00:00.000Z");
});
