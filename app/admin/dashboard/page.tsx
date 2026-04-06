import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { getAdminDashboardOverview } from "../../actions/admin-actions";
import { AdminPageHeader } from "../_components/admin-page-header";

function formatDateRange(startsAt: Date, endsAt: Date, locale: string) {
  return `${startsAt.toLocaleDateString(locale)} - ${endsAt.toLocaleDateString(locale)}`;
}

export default async function SuperAdminDashboardPage() {
  const t = await getTranslations("Admin");
  const locale = await getLocale();
  const overview = await getAdminDashboardOverview();

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
          <p className="metric-label">Total Active Clubs</p>
          <p className="metric-value">{overview.totalActiveClubs}</p>
        </article>

        <article className="metric-card">
          <p className="metric-label">Conference Members</p>
          <p className="metric-value">{overview.totalConferenceMembers}</p>
          <p className="metric-caption">From active members in active roster years.</p>
        </article>

        <article className="metric-card">
          <p className="metric-label">Upcoming Events</p>
          <p className="metric-value">{overview.upcomingEvents.length}</p>
          <p className="metric-caption">Events ending today or later.</p>
        </article>

        <article className="metric-card">
          <p className="metric-label">Pending TLT Applications</p>
          <p className="metric-value">{overview.pendingTltApplications}</p>
          <p className="metric-caption">
            <Link href="/admin/tlt?status=pending" className="text-indigo-600 underline underline-offset-2">
              Review applications
            </Link>
          </p>
        </article>
      </div>

      <article className="glass-panel">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="section-title">System Health</h2>
            <p className="section-copy">
              Launch-critical startup checks and maintenance warnings surfaced from the live system state.
            </p>
          </div>
          <span className={overview.systemHealth.warnings.length === 0 ? "status-chip-success" : "status-chip-warning"}>
            {overview.systemHealth.warnings.length === 0 ? "Healthy" : `${overview.systemHealth.warnings.length} warning${overview.systemHealth.warnings.length === 1 ? "" : "s"}`}
          </span>
        </div>

        {overview.systemHealth.warnings.length === 0 ? (
          <p className="alert-success mt-4">No system-health warnings detected.</p>
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
          <h2 className="section-title">Upcoming Event Timeline</h2>
          <Link
            href="/admin/events/new"
            className="btn-primary"
          >
            Create Event
          </Link>
        </div>

        {overview.upcomingEvents.length === 0 ? (
          <p className="empty-state mt-4 text-sm text-slate-600">No upcoming events have been scheduled.</p>
        ) : (
          <div className="glass-table table-shell mt-4 overflow-x-auto">
            <table className="text-sm">
              <thead>
                <tr>
                  <th scope="col" className="px-4 py-3">Event</th>
                  <th scope="col" className="px-4 py-3">Dates</th>
                  <th scope="col" className="px-4 py-3">Location</th>
                  <th scope="col" className="px-4 py-3">Registrations</th>
                  <th scope="col" className="px-4 py-3">Actions</th>
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
                        Open Overseer
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
