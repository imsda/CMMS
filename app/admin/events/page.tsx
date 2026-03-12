import Link from "next/link";

import { getAdminEventsIndexData } from "../../actions/admin-actions";

function formatDateRange(startsAt: Date, endsAt: Date) {
  return `${startsAt.toLocaleDateString()} - ${endsAt.toLocaleDateString()}`;
}

export default async function AdminEventsPage() {
  const events = await getAdminEventsIndexData();

  return (
    <section className="space-y-6">
      <header className="glass-panel">
        <p className="hero-kicker">Super Admin</p>
        <h1 className="hero-title mt-3">Event Management</h1>
        <p className="hero-copy">
          Review event windows, registration status, and open overseer pages.
        </p>
        <div className="mt-4">
          <Link
            href="/admin/events/new"
            className="btn-primary inline-flex"
          >
            Create Event
          </Link>
        </div>
      </header>

      <article className="glass-table table-shell overflow-hidden">
        {events.length === 0 ? (
          <p className="empty-state m-4 text-sm text-slate-600">No events found. Create your first event.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Dates</th>
                  <th className="px-4 py-3">Registration</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Clubs</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
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
                          className="btn-secondary px-3 py-1.5 text-xs"
                        >
                          Open Overseer
                        </Link>
                        <Link
                          href={`/admin/events/${event.id}/edit`}
                          className="btn-secondary px-3 py-1.5 text-xs"
                        >
                          Edit
                        </Link>
                        <Link
                          href={`/admin/events/${event.id}/classes`}
                          className="btn-secondary px-3 py-1.5 text-xs"
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
