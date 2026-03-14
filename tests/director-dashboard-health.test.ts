import test from "node:test";
import assert from "node:assert/strict";

import { buildDirectorDashboardHealth } from "../lib/director-dashboard-health";

test("director dashboard health highlights missing roster, compliance, event, and reporting actions", () => {
  const health = buildDirectorDashboardHealth({
    hasActiveRoster: true,
    activeMemberCount: 18,
    missingConsentCount: 2,
    adultCount: 3,
    unclearedAdultCount: 1,
    upcomingEventCount: 2,
    draftRegistrationCount: 1,
    submittedRegistrationCount: 0,
    notStartedEventCount: 1,
    currentMonthReportStatus: null,
    latestMonthlyReportStatus: "SUBMITTED",
    currentMonthActivityCount: 0,
    yearEndReportStatus: null,
  });

  assert.equal(health.cards.find((card) => card.key === "roster")?.status, "attention");
  assert.equal(health.cards.find((card) => card.key === "compliance")?.status, "attention");
  assert.equal(health.cards.find((card) => card.key === "events")?.status, "attention");
  assert.equal(health.cards.find((card) => card.key === "reporting")?.status, "attention");
  assert.equal(health.cards.find((card) => card.key === "activity")?.status, "attention");
  assert.ok(health.alerts.length >= 4);
});

test("director dashboard health marks categories ready when source-of-truth data is complete", () => {
  const health = buildDirectorDashboardHealth({
    hasActiveRoster: true,
    activeMemberCount: 24,
    missingConsentCount: 0,
    adultCount: 4,
    unclearedAdultCount: 0,
    upcomingEventCount: 2,
    draftRegistrationCount: 0,
    submittedRegistrationCount: 2,
    notStartedEventCount: 0,
    currentMonthReportStatus: "SUBMITTED",
    latestMonthlyReportStatus: "SUBMITTED",
    currentMonthActivityCount: 3,
    yearEndReportStatus: "SUBMITTED",
  });

  assert.equal(health.cards.every((card) => card.status === "ready"), true);
  assert.deepEqual(health.alerts, []);
});

test("director dashboard health treats monthly reports under review as current progress", () => {
  const health = buildDirectorDashboardHealth({
    hasActiveRoster: true,
    activeMemberCount: 20,
    missingConsentCount: 0,
    adultCount: 4,
    unclearedAdultCount: 0,
    upcomingEventCount: 1,
    draftRegistrationCount: 0,
    submittedRegistrationCount: 1,
    notStartedEventCount: 0,
    currentMonthReportStatus: "UNDER_REVIEW",
    latestMonthlyReportStatus: "UNDER_REVIEW",
    currentMonthActivityCount: 2,
    yearEndReportStatus: "SUBMITTED",
  });

  assert.equal(health.cards.find((card) => card.key === "reporting")?.status, "ready");
});
