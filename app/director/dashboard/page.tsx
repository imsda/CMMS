import Link from "next/link";
import { MemberRole, RegistrationStatus } from "@prisma/client";
import { getLocale, getTranslations } from "next-intl/server";

import { getMonthWindow, parseMonthInput } from "../../../lib/club-activity";
import { getManagedClubContext } from "../../../lib/club-management";
import { getDirectorComplianceDashboardData } from "../../../lib/data/compliance-dashboard";
import { buildDirectorDashboardHealth } from "../../../lib/director-dashboard-health";
import { buildDirectorPath } from "../../../lib/director-path";
import { formatDateRange } from "../../../lib/format";
import { prisma } from "../../../lib/prisma";

function formatDateTime(value: Date | null, locale: string, noneLabel: string) {
  return value ? value.toLocaleString(locale) : noneLabel;
}

export default async function ClubDirectorDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ clubId?: string }>;
}) {
  const td = await getTranslations("Director");
  const locale = await getLocale();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  let managedClub;
  try {
    managedClub = await getManagedClubContext(resolvedSearchParams?.clubId ?? null);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load club context.";
    return (
      <section className="glass-panel mx-auto max-w-lg py-12 text-center">
        <h2 className="text-lg font-semibold text-slate-900">{td("dashboard.errorTitle")}</h2>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/director/events" className="btn-primary">
            {td("dashboard.continueRegistration")}
          </Link>
        </div>
      </section>
    );
  }

  const club = await prisma.club.findUnique({
    where: {
      id: managedClub.clubId,
    },
    include: {
      rosterYears: {
        where: {
          isActive: true,
        },
        include: {
          members: {
            where: {
              isActive: true,
            },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              memberRole: true,
              backgroundCheckCleared: true,
              photoReleaseConsent: true,
              medicalTreatmentConsent: true,
              membershipAgreementConsent: true,
            },
          },
        },
        orderBy: {
          startsOn: "desc",
        },
        take: 1,
      },
    },
  });

  if (!club) {
    return (
      <section className="glass-panel">
        <h1 className="text-xl font-semibold">{td("common.clubNotFound")}</h1>
        <p className="mt-2 text-sm">{td("dashboard.clubNotFoundDescription")}</p>
      </section>
    );
  }

  const activeRoster = club.rosterYears[0] ?? null;
  const activeMembers = activeRoster?.members ?? [];
  const currentMonthStart = parseMonthInput();
  const { monthEndExclusive } = getMonthWindow(currentMonthStart);

  const upcomingEventsPromise = prisma.event.findMany({
    where: {
      endsAt: {
        gte: new Date(),
      },
    },
    select: {
      id: true,
      name: true,
      startsAt: true,
      endsAt: true,
    },
    orderBy: {
      startsAt: "asc",
    },
    take: 4,
  });

  const clubRegistrationsPromise = prisma.eventRegistration.findMany({
    where: {
      clubId: club.id,
    },
    select: {
      eventId: true,
      status: true,
      _count: {
        select: {
          attendees: true,
        },
      },
    },
  });

  const currentMonthActivityCountPromise = activeRoster
    ? prisma.clubActivity.count({
        where: {
          clubRosterYearId: activeRoster.id,
          activityDate: {
            gte: currentMonthStart,
            lt: monthEndExclusive,
          },
        },
      })
    : Promise.resolve(0);

  const latestMonthlyReportPromise = prisma.monthlyReport.findFirst({
    where: {
      clubId: club.id,
    },
    orderBy: {
      reportMonth: "desc",
    },
    select: {
      reportMonth: true,
      status: true,
    },
  });

  const currentMonthReportPromise = prisma.monthlyReport.findUnique({
    where: {
      clubId_reportMonth: {
        clubId: club.id,
        reportMonth: currentMonthStart,
      },
    },
    select: {
      status: true,
    },
  });

  const latestYearEndReportPromise = prisma.yearEndReport.findFirst({
    where: {
      clubId: club.id,
    },
    orderBy: {
      reportYear: "desc",
    },
    select: {
      status: true,
    },
  });

  const [upcomingEvents, clubRegistrations, currentMonthActivityCount, latestMonthlyReport, currentMonthReport, latestYearEndReport] = await Promise.all([
    upcomingEventsPromise,
    clubRegistrationsPromise,
    currentMonthActivityCountPromise,
    latestMonthlyReportPromise,
    currentMonthReportPromise,
    latestYearEndReportPromise,
  ]);
  const complianceDashboard = await getDirectorComplianceDashboardData(club.id);

  type ClubRegistrationSummary = Awaited<typeof clubRegistrationsPromise>[number];

  const registrationByEventId = new Map<string, ClubRegistrationSummary>(
    clubRegistrations.map((registration) => [registration.eventId, registration]),
  );

  const submittedRegistrations = clubRegistrations.filter(
    (registration) => registration.status === RegistrationStatus.SUBMITTED,
  ).length;

  const draftRegistrations = clubRegistrations.filter(
    (registration) => registration.status === RegistrationStatus.DRAFT,
  ).length;

  const notStartedRegistrations = upcomingEvents.filter(
    (event) => !registrationByEventId.has(event.id),
  ).length;

  const staffMissingClearance = activeMembers.filter(
    (member) =>
      (member.memberRole === MemberRole.STAFF || member.memberRole === MemberRole.DIRECTOR) &&
      !member.backgroundCheckCleared,
  );

  const alerts: string[] = [];

  if (!activeRoster) {
    alerts.push(td("dashboard.alerts.noActiveRoster"));
  }

  if (staffMissingClearance.length > 0) {
    alerts.push(
      td("dashboard.alerts.missingClearance", { count: staffMissingClearance.length }),
    );
  }

  if (upcomingEvents.length === 0) {
    alerts.push(td("dashboard.alerts.noUpcomingEvents"));
  }

  const dashboardHealth = buildDirectorDashboardHealth({
    hasActiveRoster: Boolean(activeRoster),
    activeMemberCount: activeMembers.length,
    missingConsentCount: activeMembers.filter(
      (member) =>
        !member.photoReleaseConsent || !member.medicalTreatmentConsent || !member.membershipAgreementConsent,
    ).length,
    adultCount: complianceDashboard?.compliance.adultCount ?? 0,
    unclearedAdultCount: complianceDashboard?.compliance.unclearedAdultCount ?? 0,
    upcomingEventCount: upcomingEvents.length,
    draftRegistrationCount: draftRegistrations,
    submittedRegistrationCount: submittedRegistrations,
    notStartedEventCount: notStartedRegistrations,
    currentMonthReportStatus: currentMonthReport?.status ?? null,
    latestMonthlyReportStatus: latestMonthlyReport?.status ?? null,
    currentMonthActivityCount: activeRoster ? currentMonthActivityCount : null,
    yearEndReportStatus: latestYearEndReport?.status ?? null,
  });

  return (
    <section className="space-y-8">
      <div className="glass-panel flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="hero-kicker">{td("dashboard.eyebrow")}</p>
          <h2 className="hero-title mt-3">{club.name}</h2>
          {club.district ? (
            <p className="mt-1 text-sm text-slate-500">{club.district}</p>
          ) : null}
          <p className="hero-copy">
            {td("dashboard.description")}
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href={buildDirectorPath("/director/roster", managedClub.clubId, managedClub.isSuperAdmin)}
            className="btn-secondary"
          >
            {td("dashboard.viewRoster")}
          </Link>
          <Link
            href={buildDirectorPath("/director/events", managedClub.clubId, managedClub.isSuperAdmin)}
            className="btn-primary"
          >
            {td("dashboard.continueRegistration")}
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <article className="metric-card">
          <p className="metric-label">{td("dashboard.metrics.activeMembers")}</p>
          <p className="metric-value">{activeMembers.length}</p>
          <p className="metric-caption">{td("dashboard.metrics.activeMembersCaption")}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">{td("dashboard.metrics.upcomingEvents")}</p>
          <p className="metric-value">{upcomingEvents.length}</p>
          <p className="metric-caption">{td("dashboard.metrics.upcomingEventsCaption")}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">{td("dashboard.metrics.submittedRegistrations")}</p>
          <p className="metric-value">{submittedRegistrations}</p>
          <p className="metric-caption">{td("dashboard.metrics.submittedRegistrationsCaption")}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">{td("dashboard.metrics.draftRegistrations")}</p>
          <p className="metric-value">{draftRegistrations}</p>
          <p className="metric-caption">{td("dashboard.metrics.draftRegistrationsCaption")}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">{td("dashboard.metrics.activitiesThisMonth")}</p>
          <p className="metric-value">{currentMonthActivityCount}</p>
          <p className="metric-caption">{td("dashboard.metrics.activitiesThisMonthCaption")}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">{td("dashboard.metrics.latestMonthlyReport")}</p>
          <p className="metric-value text-2xl">
            {latestMonthlyReport ? latestMonthlyReport.status : td("common.none")}
          </p>
          <p className="metric-caption">
            {latestMonthlyReport
              ? td("dashboard.metrics.latestMonth", { month: latestMonthlyReport.reportMonth.toLocaleDateString(locale, {
                  month: "short",
                  year: "numeric",
                }) })
              : td("dashboard.metrics.latestMonthlyReportEmpty")}
          </p>
        </article>
        <article className="metric-card">
          <p className="metric-label">{td("dashboard.metrics.adultClearances")}</p>
          <p className="metric-value">
            {complianceDashboard ? `${complianceDashboard.compliance.clearedAdultCount}/${complianceDashboard.compliance.adultCount}` : "0/0"}
          </p>
          <p className="metric-caption">
            {complianceDashboard
              ? td("dashboard.metrics.adultClearancesCaption", { rate: complianceDashboard.compliance.clearanceRate })
              : td("dashboard.metrics.adultClearancesEmpty")}
          </p>
        </article>
      </div>

      <article className="glass-panel">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="section-title">{td("dashboard.snapshot.title")}</h3>
            <p className="section-copy">
              {td("dashboard.snapshot.description")}
            </p>
          </div>
          <span className="status-chip-neutral">{td("dashboard.snapshot.healthAreas", { count: dashboardHealth.cards.length })}</span>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {dashboardHealth.cards.map((card) => (
            <article key={card.key} className="glass-card-soft">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.title}</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{card.summary}</p>
              <p className="mt-2 text-sm text-slate-600">{card.detail}</p>
              <p className="mt-3 text-xs font-medium text-slate-500">
                {card.status.toUpperCase()} • {card.action}
              </p>
            </article>
          ))}
        </div>
      </article>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="glass-panel">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="section-title">{td("dashboard.upcomingEvents.title")}</h3>
            <Link
              href={buildDirectorPath("/director/events", managedClub.clubId, managedClub.isSuperAdmin)}
              className="btn-secondary px-3 py-1.5 text-xs"
            >
              {td("dashboard.upcomingEvents.openList")}
            </Link>
          </div>

          {upcomingEvents.length === 0 ? (
            <p className="empty-state text-sm text-slate-600">{td("dashboard.upcomingEvents.empty")}</p>
          ) : (
            <ol className="space-y-3">
              {upcomingEvents.map((event) => {
                const registration = registrationByEventId.get(event.id);

                return (
                  <li
                    key={event.id}
                    className="glass-card-soft flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{event.name}</p>
                      <p className="text-xs text-slate-600">{formatDateRange(event.startsAt, event.endsAt, locale)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-slate-700">
                        {registration?.status ?? td("common.notStarted")}
                      </p>
                      <p className="text-xs text-slate-500">
                        {td("common.attendeesCount", { count: registration?._count.attendees ?? 0 })}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </article>

        <article className="glass-panel">
          <div className="mb-4">
            <h3 className="section-title">{td("dashboard.compliance.title")}</h3>
            <p className="section-copy">
              {td("dashboard.compliance.description")}
            </p>
          </div>

          {!complianceDashboard ? (
            <p className="empty-state text-sm text-slate-600">{td("dashboard.compliance.empty")}</p>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="glass-card-soft">
                  <p className="text-xs uppercase tracking-wide text-slate-500">{td("dashboard.compliance.adultRolesCleared")}</p>
                  <p className="text-2xl font-semibold text-slate-900">
                    {complianceDashboard.compliance.clearedAdultCount} / {complianceDashboard.compliance.adultCount}
                  </p>
                  <p className="text-xs text-slate-500">
                    {td("dashboard.compliance.missingClearance", { count: complianceDashboard.compliance.unclearedAdultCount })}
                  </p>
                </div>
                <div className="glass-card-soft">
                  <p className="text-xs uppercase tracking-wide text-slate-500">{td("dashboard.compliance.latestAdminSync")}</p>
                  <p className="text-2xl font-semibold text-slate-900">{complianceDashboard.compliance.latestRunStatus}</p>
                  <p className="text-xs text-slate-500">
                    {formatDateTime(complianceDashboard.compliance.latestRunAt, locale, td("common.none"))}
                  </p>
                </div>
              </div>

              {complianceDashboard.recentRuns.length > 0 ? (
                <div className="glass-card-soft">
                  <p className="text-sm font-semibold text-slate-900">{td("dashboard.compliance.recentActivity")}</p>
                  <ol className="mt-3 space-y-2 text-sm text-slate-700">
                    {complianceDashboard.recentRuns.map((run) => (
                      <li key={run.id} className="flex items-center justify-between gap-3">
                        <span>
                          {run.status} • {run.fileName}
                        </span>
                        <span className="text-xs text-slate-500">
                          {run.updateCount} update(s), {run.ambiguousCount} ambiguous
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}

              {complianceDashboard.adultMembersMissingClearance.length > 0 ? (
                <div className="glass-card-soft">
                  <p className="text-sm font-semibold text-slate-900">{td("dashboard.compliance.adultsBlocking")}</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-700">
                    {complianceDashboard.adultMembersMissingClearance.slice(0, 6).map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="alert-success">{td("dashboard.compliance.clear")}</p>
              )}
            </div>
          )}
        </article>

        <article className="glass-panel">
          <h3 className="section-title">{td("dashboard.alerts.title")}</h3>
          {alerts.length === 0 && dashboardHealth.alerts.length === 0 ? (
            <p className="alert-success mt-4">{td("dashboard.alerts.empty")}</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {[...alerts, ...dashboardHealth.alerts].map((alert) => (
                <li
                  key={alert}
                  className="alert-warning"
                >
                  {alert}
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </section>
  );
}
