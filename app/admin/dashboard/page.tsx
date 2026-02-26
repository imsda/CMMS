import Link from "next/link";

import { getAdminDashboardOverview } from "../../actions/admin-actions";

function formatDateRange(startsAt: Date, endsAt: Date) {
  return `${startsAt.toLocaleDateString()} - ${endsAt.toLocaleDateString()}`;
}

export default async function SuperAdminDashboardPage() {
  const overview = await getAdminDashboardOverview();

  return (
    <section className="space-y-8">
      <header>
        <p className="text-sm font-medium text-slate-500">Super Admin Dashboard</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Conference Overview</h1>
        <p className="mt-1 text-sm text-slate-600">
          Monitor club participation, conference member totals, and active event windows.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Total Active Clubs</p>
          <p className="mt-2 text-4xl font-semibold text-slate-900">{overview.totalActiveClubs}</p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Conference Members</p>
          <p className="mt-2 text-4xl font-semibold text-slate-900">{overview.totalConferenceMembers}</p>
          <p className="mt-2 text-xs text-slate-500">From active members in active roster years.</p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Upcoming Events</p>
          <p className="mt-2 text-4xl font-semibold text-slate-900">{overview.upcomingEvents.length}</p>
          <p className="mt-2 text-xs text-slate-500">Events ending today or later.</p>
        </article>
      </div>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Upcoming Event Timeline</h2>
          <Link
            href="/admin/events/new"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Create Event
          </Link>
        </div>

        {overview.upcomingEvents.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No upcoming events have been scheduled.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Dates</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Registrations</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {overview.upcomingEvents.map((event) => (
                  <tr key={event.id} className="align-top">
                    <td className="px-4 py-3 font-medium text-slate-900">{event.name}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDateRange(event.startsAt, event.endsAt)}</td>
                    <td className="px-4 py-3 text-slate-700">{event.locationName ?? "TBD"}</td>
                    <td className="px-4 py-3 text-slate-700">{event._count.registrations}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/events/${event.id}`}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700"
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
