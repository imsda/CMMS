import Link from "next/link";

import { getAdminDashboardOverview } from "../../actions/admin-actions";

function formatDateRange(startsAt: Date, endsAt: Date) {
  return `${startsAt.toLocaleDateString()} - ${endsAt.toLocaleDateString()}`;
}

export default async function SuperAdminDashboardPage() {
  const overview = await getAdminDashboardOverview();

  return (
    <section className="space-y-8">
      <header className="glass-panel">
        <p className="hero-kicker">Super Admin Dashboard</p>
        <h1 className="hero-title mt-3">Conference Overview</h1>
        <p className="hero-copy">
          Monitor club participation, conference member totals, and active event windows.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
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
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Dates</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Registrations</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {overview.upcomingEvents.map((event) => (
                  <tr key={event.id} className="align-top">
                    <td className="px-4 py-3 font-medium text-slate-900">{event.name}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDateRange(event.startsAt, event.endsAt)}</td>
                    <td className="px-4 py-3 text-slate-700">{event.locationName ?? "TBD"}</td>
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
