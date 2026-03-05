import Link from "next/link";

import { getAdminEventsIndexData } from "../../actions/admin-actions";

function formatDateRange(startsAt: Date, endsAt: Date) {
  return `${startsAt.toLocaleDateString()} - ${endsAt.toLocaleDateString()}`;
}

export default async function AdminEventsPage() {
  const events = await getAdminEventsIndexData();

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Super Admin</p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-900">Event Management</h1>
        <p className="mt-2 text-sm text-slate-600">
          Review event windows, registration status, and open overseer pages.
        </p>
        <div className="mt-4">
          <Link
            href="/admin/events/new"
            className="inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Create Event
          </Link>
        </div>
      </header>

      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {events.length === 0 ? (
          <p className="px-6 py-5 text-sm text-slate-600">No events found. Create your first event.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Dates</th>
                  <th className="px-4 py-3">Registration</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Clubs</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {events.map((event) => (
                  <tr key={event.id}>
                    <td className="px-4 py-3 text-slate-900">
                      <p className="font-semibold">{event.name}</p>
                      <p className="text-xs text-slate-500">{event.slug}</p>
                      <p className="mt-1 text-xs">
                        <span
                          className={`rounded-full px-2 py-0.5 font-semibold ${
                            event.eventStatus === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {event.eventStatus}
                        </span>
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{formatDateRange(event.startsAt, event.endsAt)}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <p>{formatDateRange(event.registrationOpensAt, event.registrationClosesAt)}</p>
                      <p className="mt-1 text-xs">
                        <span
                          className={`rounded-full px-2 py-0.5 font-semibold ${
                            event.registrationWindowStatus === "OPEN"
                              ? "bg-emerald-100 text-emerald-700"
                              : event.registrationWindowStatus === "UPCOMING"
                                ? "bg-sky-100 text-sky-700"
                                : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {event.registrationWindowStatus}
                        </span>
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{event.locationName ?? "TBD"}</td>
                    <td className="px-4 py-3 text-slate-700">{event._count.registrations}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Link
                          href={`/admin/events/${event.id}`}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700"
                        >
                          Open Overseer
                        </Link>
                        <Link
                          href={`/admin/events/${event.id}/edit`}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700"
                        >
                          Edit
                        </Link>
                        <Link
                          href={`/admin/events/${event.id}/classes`}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700"
                        >
                          Classes
                        </Link>
                      </div>
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
