import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getAdminEventRegistrations,
  getMasterEventAttendeesCsv,
} from "../../../actions/admin-actions";

function formatDateRange(startsAt: Date, endsAt: Date) {
  return `${startsAt.toLocaleDateString()} - ${endsAt.toLocaleDateString()}`;
}

type EventOverseerPageProps = {
  params: Promise<{
    eventId: string;
  }>;
};

export default async function EventOverseerPage({ params }: EventOverseerPageProps) {
  const { eventId } = await params;
  const event = await getAdminEventRegistrations(eventId);

  if (!event) {
    notFound();
  }

  const csvData = await getMasterEventAttendeesCsv(eventId);
  const csvHref = `data:text/csv;charset=utf-8,${encodeURIComponent(csvData.content)}`;

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Event Overseer</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{event.name}</h1>
        <p className="mt-1 text-sm text-slate-600">{event.description ?? "No description provided."}</p>

        <dl className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
          <div>
            <dt className="font-semibold text-slate-900">Dates</dt>
            <dd>{formatDateRange(event.startsAt, event.endsAt)}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-900">Registration Window</dt>
            <dd>{formatDateRange(event.registrationOpensAt, event.registrationClosesAt)}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-900">Location</dt>
            <dd>{event.locationName ?? "TBD"}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-900">Address</dt>
            <dd>{event.locationAddress ?? "TBD"}</dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href={csvHref}
            download={csvData.fileName}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Download Master Attendees CSV
          </a>
          <Link
            href="/admin/dashboard"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700"
          >
            Back to Dashboard
          </Link>
        </div>
      </header>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Club Registrations</h2>
        <p className="mt-1 text-sm text-slate-600">
          Conference-wide registration list and attendee totals across all clubs.
        </p>

        {event.registrations.length === 0 ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            No clubs have started registration for this event.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3">Club</th>
                  <th className="px-4 py-3">Registration Code</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Attendees</th>
                  <th className="px-4 py-3">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {event.registrations.map((registration) => (
                  <tr key={registration.id} className="align-top">
                    <td className="px-4 py-3 text-slate-900">
                      <p className="font-semibold">{registration.club.name}</p>
                      <p className="text-xs text-slate-500">{registration.club.code}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{registration.registrationCode}</td>
                    <td className="px-4 py-3 text-slate-700">{registration.status}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <p>{registration.attendees.length}</p>
                      <ul className="mt-1 space-y-1 text-xs text-slate-500">
                        {registration.attendees.slice(0, 4).map((attendee) => (
                          <li key={attendee.id}>
                            {attendee.rosterMember.firstName} {attendee.rosterMember.lastName}
                          </li>
                        ))}
                        {registration.attendees.length > 4 ? (
                          <li>+{registration.attendees.length - 4} more</li>
                        ) : null}
                      </ul>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {registration.submittedAt ? registration.submittedAt.toLocaleDateString() : "Not submitted"}
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
