import assert from "node:assert/strict";
import test from "node:test";
import { MonthlyReportStatus } from "@prisma/client";

import {
  buildMonthlyReportScoreLineItems,
  calculateMonthlyReportTotalScore,
  formatMonthlyReportStatus,
  isMonthlyReportEditable,
} from "../lib/monthly-report";

test("monthly report scoring builds structured line items and totals", () => {
  const lineItems = buildMonthlyReportScoreLineItems({
    averageAttendance: 42,
    pathfinderCount: 28,
    tltCount: 4,
    staffCount: 8,
    staffMeetingHeld: true,
    meetingOutingCount: 3,
    devotionsEmphasis: "Focused on daily worship and prayer partners.",
    exercisePromotion: "Completed a club hike and drill rotation.",
    outreachActivities: "Visited a nursing home and delivered care kits.",
    guestHelperCount: 5,
    uniformCompliance: 91,
    honorWorkSummary: "Three honors advanced during weekly instruction blocks.",
    honorParticipantCount: 18,
    bonusNotes: "Hosted conference area drill clinic.",
  });

  assert.equal(lineItems.length >= 10, true);
  assert.equal(calculateMonthlyReportTotalScore({
    averageAttendance: 42,
    pathfinderCount: 28,
    tltCount: 4,
    staffCount: 8,
    staffMeetingHeld: true,
    meetingOutingCount: 3,
    devotionsEmphasis: "Focused on daily worship and prayer partners.",
    exercisePromotion: "Completed a club hike and drill rotation.",
    outreachActivities: "Visited a nursing home and delivered care kits.",
    guestHelperCount: 5,
    uniformCompliance: 91,
    honorWorkSummary: "Three honors advanced during weekly instruction blocks.",
    honorParticipantCount: 18,
    bonusNotes: "Hosted conference area drill clinic.",
  }), lineItems.reduce((sum, item) => sum + item.points, 0));
});

test("monthly report helpers expose review-state labels and editability", () => {
  assert.equal(formatMonthlyReportStatus(MonthlyReportStatus.UNDER_REVIEW), "Under Review");
  assert.equal(formatMonthlyReportStatus(MonthlyReportStatus.REVISION_REQUESTED), "Revision Requested");
  assert.equal(isMonthlyReportEditable(MonthlyReportStatus.DRAFT), true);
  assert.equal(isMonthlyReportEditable(MonthlyReportStatus.REVISION_REQUESTED), true);
  assert.equal(isMonthlyReportEditable(MonthlyReportStatus.APPROVED), false);
});
