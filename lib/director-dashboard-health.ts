export type DirectorDashboardHealthCard = {
  key: "roster" | "compliance" | "events" | "reporting" | "activity";
  title: string;
  status: "ready" | "attention" | "pending";
  summary: string;
  detail: string;
  action: string;
};

function statusFromCount(count: number) {
  return count > 0 ? "attention" : "ready";
}

export function buildDirectorDashboardHealth(input: {
  hasActiveRoster: boolean;
  activeMemberCount: number;
  missingConsentCount: number;
  adultCount: number;
  unclearedAdultCount: number;
  upcomingEventCount: number;
  draftRegistrationCount: number;
  submittedRegistrationCount: number;
  notStartedEventCount: number;
  currentMonthReportStatus: string | null;
  latestMonthlyReportStatus: string | null;
  currentMonthActivityCount: number | null;
  yearEndReportStatus: string | null;
}) {
  const currentMonthlyReady =
    input.currentMonthReportStatus === "SUBMITTED" ||
    input.currentMonthReportStatus === "UNDER_REVIEW" ||
    input.currentMonthReportStatus === "APPROVED";

  const latestMonthlyReady =
    input.latestMonthlyReportStatus === "SUBMITTED" ||
    input.latestMonthlyReportStatus === "UNDER_REVIEW" ||
    input.latestMonthlyReportStatus === "APPROVED";

  const rosterStatus = !input.hasActiveRoster
    ? "attention"
    : input.activeMemberCount === 0 || input.missingConsentCount > 0
      ? "attention"
      : "ready";

  const complianceStatus =
    input.adultCount === 0 ? "pending" : statusFromCount(input.unclearedAdultCount);

  const eventStatus =
    input.upcomingEventCount === 0
      ? "pending"
      : input.draftRegistrationCount > 0 || input.notStartedEventCount > 0
        ? "attention"
        : input.submittedRegistrationCount > 0
          ? "ready"
          : "pending";

  const reportingStatus =
    currentMonthlyReady
      ? "ready"
      : input.currentMonthActivityCount !== null && input.currentMonthActivityCount > 0
        ? "attention"
        : latestMonthlyReady
          ? "attention"
          : "pending";

  const activityStatus =
    input.currentMonthActivityCount === null
      ? "pending"
      : input.currentMonthActivityCount > 0
        ? "ready"
        : "attention";

  const cards: DirectorDashboardHealthCard[] = [
    {
      key: "roster",
      title: "Roster Health",
      status: rosterStatus,
      summary: !input.hasActiveRoster
        ? "No active roster year"
        : `${input.activeMemberCount} active member${input.activeMemberCount === 1 ? "" : "s"}`,
      detail: input.missingConsentCount > 0
        ? `${input.missingConsentCount} member record(s) still need core consent confirmations.`
        : "Roster year and member records are in place.",
      action: !input.hasActiveRoster ? "Run annual rollover and activate a roster year." : "Review roster records for completeness.",
    },
    {
      key: "compliance",
      title: "Compliance Health",
      status: complianceStatus,
      summary:
        input.adultCount === 0
          ? "No adult roles on roster"
          : `${input.adultCount - input.unclearedAdultCount}/${input.adultCount} adults cleared`,
      detail:
        input.unclearedAdultCount > 0
          ? `${input.unclearedAdultCount} adult leader/staff record(s) can still block event submissions.`
          : "No adult clearance blockers are currently detected.",
      action: "Coordinate with conference admins if Sterling clearance blockers remain.",
    },
    {
      key: "events",
      title: "Event Readiness",
      status: eventStatus,
      summary:
        input.upcomingEventCount === 0
          ? "No upcoming events"
          : `${input.submittedRegistrationCount} submitted, ${input.draftRegistrationCount} draft`,
      detail:
        input.notStartedEventCount > 0
          ? `${input.notStartedEventCount} upcoming event(s) have not been started yet.`
          : "Upcoming event registrations are started or finalized.",
      action: "Open upcoming events and finish any draft or unstarted registrations.",
    },
    {
      key: "reporting",
      title: "Reporting Health",
      status: reportingStatus,
      summary:
        input.currentMonthReportStatus ??
        input.latestMonthlyReportStatus ??
        input.yearEndReportStatus ??
        "No monthly reports",
      detail:
        currentMonthlyReady
          ? "Current month reporting is already submitted."
          : input.yearEndReportStatus
            ? `Year-end reporting status is ${input.yearEndReportStatus}.`
            : "Monthly reporting is still open or pending for the current month.",
      action: "Submit the current monthly report once activity data is ready.",
    },
    {
      key: "activity",
      title: "Activity Health",
      status: activityStatus,
      summary:
        input.currentMonthActivityCount === null
          ? "Activity tracking unavailable"
          : `${input.currentMonthActivityCount} activity log(s) this month`,
      detail:
        input.currentMonthActivityCount && input.currentMonthActivityCount > 0
          ? "Monthly report auto-fill has recent activity data to work from."
          : "No activity logs have been recorded for the current month yet.",
      action: "Log recent club activities so reporting and readiness stay current.",
    },
  ];

  const alerts = cards
    .filter((card) => card.status !== "ready")
    .map((card) => `${card.title}: ${card.action}`);

  return {
    cards,
    alerts,
  };
}
