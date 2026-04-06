import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { getAdminDashboardOverview } from "../../actions/admin-actions";
import { formatDateRange } from "../../../lib/format";
import { AdminPageHeader } from "../_components/admin-page-header";

export default async function SuperAdminDashboardPage() {
  const t = await getTranslations("Admin");
  const locale = await getLocale();

  let overview;
  try {
    overview = await getAdminDashboardOverview();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load dashboard data.";
    return (
      <section className="glass-panel mx-auto max-w-lg py-12 text-center">
        <h2 className="text-lg font-semibold text-slate-900">{t("pages.dashboard.errorTitle")}</h2>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <AdminPageHeader
        eyebrow={t("pages.dashboard.eyebrow")}
        breadcrumbs={[{ label: t("breadcrumbs.admin"), href: "/admin/dashboard" }, { label: t("breadcrumbs.dashboard") }]}
        title={t("pages.dashboard.title")}
        description={t("pages.dashboard.description")}
        primaryAction={
          <Link href="/admin/events/new" className="btn-primary">
            {t("actions.createEvent")}
          </Link>
        }
        secondaryActions={
          <Link href="/admin/reports" className="btn-secondary">
            {t("actions.reviewReports")}
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <article className="metric-card">
          <p className="metric-label">{t("pages.dashboard.metrics.totalActiveClubs")}</p>
          <p className="metric-value">{overview.totalActiveClubs}</p>
        </article>

        <article className="metric-card">
          <p className="metric-label">{t("pages.dashboard.metrics.conferenceMembers")}</p>
          <p className="metric-value">{overview.totalConferenceMembers}</p>
          <p className="metric-caption">{t("pages.dashboard.metrics.conferenceMembersCaption")}</p>
        </article>

        <article className="metric-card">
          <p className="metric-label">{t("pages.dashboard.metrics.upcomingEvents")}</p>
          <p className="metric-value">{overview.upcomingEvents.length}</p>
          <p className="metric-caption">{t("pages.dashboard.metrics.upcomingEventsCaption")}</p>
        </article>

        <article className="metric-card">
          <p className="metric-label">{t("pages.dashboard.metrics.pendingTltApplications")}</p>
          <p className="metric-value">{overview.pendingTltApplications}</p>
          <p className="metric-caption">
            <Link href="/admin/tlt?status=pending" className="text-indigo-600 underline underline-offset-2">
              {t("actions.reviewApplications")}
            </Link>
          </p>
        </article>
      </div>

      <article className="glass-panel">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="section-title">{t("pages.dashboard.systemHealth.title")}</h2>
            <p className="section-copy">
              {t("pages.dashboard.systemHealth.description")}
            </p>
          </div>
          <span className={overview.systemHealth.warnings.length === 0 ? "status-chip-success" : "status-chip-warning"}>
            {overview.systemHealth.warnings.length === 0
              ? t("pages.dashboard.systemHealth.healthy")
              : t("pages.dashboard.systemHealth.warningCount", { count: overview.systemHealth.warnings.length })}
          </span>
        </div>

        {overview.systemHealth.warnings.length === 0 ? (
          <p className="alert-success mt-4">{t("pages.dashboard.systemHealth.noWarnings")}</p>
        ) : (
          <div className="mt-4 grid gap-3">
            {overview.systemHealth.warnings.map((warning) => (
              <article
                key={warning.code}
                className={warning.level === "critical" ? "alert-danger" : "alert-warning"}
              >
                <p className="font-semibold uppercase tracking-[0.12em]">{warning.code.replaceAll("_", " ")}</p>
                <p>{warning.message}</p>
              </article>
            ))}
          </div>
        )}
      </article>

      <article className="glass-panel">
        <div className="flex items-center justify-between">
          <h2 className="section-title">{t("pages.dashboard.eventTimeline.title")}</h2>
          <Link
            href="/admin/events/new"
            className="btn-primary"
          >
            {t("actions.createEvent")}
          </Link>
        </div>

        {overview.upcomingEvents.length === 0 ? (
          <p className="empty-state mt-4 text-sm text-slate-600">{t("pages.dashboard.eventTimeline.empty")}</p>
        ) : (
          <div className="glass-table table-shell mt-4 overflow-x-auto">
            <table className="text-sm">
              <thead>
                <tr>
                  <th scope="col" className="px-4 py-3">{t("pages.dashboard.eventTimeline.columns.event")}</th>
                  <th scope="col" className="px-4 py-3">{t("pages.dashboard.eventTimeline.columns.dates")}</th>
                  <th scope="col" className="px-4 py-3">{t("pages.dashboard.eventTimeline.columns.location")}</th>
                  <th scope="col" className="px-4 py-3">{t("pages.dashboard.eventTimeline.columns.registrations")}</th>
                  <th scope="col" className="px-4 py-3">{t("pages.dashboard.eventTimeline.columns.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {overview.upcomingEvents.map((event) => (
                  <tr key={event.id} className="align-top">
                    <td className="px-4 py-3 font-medium text-slate-900">{event.name}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDateRange(event.startsAt, event.endsAt, locale)}</td>
                    <td className="px-4 py-3 text-slate-700">{event.locationName ?? t("pages.events.tbd")}</td>
                    <td className="px-4 py-3 text-slate-700">{event._count.registrations}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/events/${event.id}`}
                        className="btn-secondary px-3 py-1.5 text-xs"
                      >
                        {t("pages.dashboard.eventTimeline.openOverseer")}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}
