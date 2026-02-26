import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getEventCheckinDashboard,
  markRegistrationCheckedIn,
} from "../../../../actions/checkin-actions";

type CheckinPageProps = {
  params: Promise<{
    eventId: string;
  }>;
};

function formatEventDateRange(startsAt: Date, endsAt: Date) {
  return `${startsAt.toLocaleDateString()} - ${endsAt.toLocaleDateString()}`;
}

function statusBadgeClasses(status: string) {
  if (status === "DRAFT") {
    return "bg-slate-100 text-slate-700 border-slate-200";
  }

  if (status === "SUBMITTED") {
    return "bg-amber-100 text-amber-800 border-amber-200";
  }

  if (status === "APPROVED") {
    return "bg-emerald-100 text-emerald-800 border-emerald-200";
  }

  return "bg-rose-100 text-rose-800 border-rose-200";
}

export default async function EventCheckinPage({ params }: CheckinPageProps) {
  const { eventId } = await params;
  const event = await getEventCheckinDashboard(eventId);

  if (!event) {
    notFound();
  }

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">On-Site Gate Check-in</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{event.name}</h1>
        <p className="mt-1 text-sm text-slate-600">{formatEventDateRange(event.startsAt, event.endsAt)}</p>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={`/admin/events/${event.id}`}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700"
          >
            Event Overview
          </Link>
          <Link
            href="/admin/dashboard"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700"
          >
            Back to Dashboard
          </Link>
        </div>
      </header>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Registration Check-in Queue</h2>
        <p className="mt-1 text-sm text-slate-600">
          Quickly mark each club as checked-in. Alerts show missing required forms you should collect at the gate.
        </p>

        {event.registrations.length === 0 ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            No clubs have started registration for this event.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {event.registrations.map((registration) => {
              const fullyCheckedIn =
                registration.attendees.length > 0 && registration.checkedInCount === registration.attendees.length;

              return (
                <div
                  key={registration.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:flex md:items-center md:justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-semibold text-slate-900">{registration.club.name}</p>
                      <span className="text-xs text-slate-500">({registration.club.code})</span>
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadgeClasses(registration.status)}`}
                      >
                        {registration.status}
                      </span>
                      {registration.hasMissingRequiredFields ? (
                        <span className="inline-flex items-center rounded-full border border-rose-300 bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-800">
                          Missing Required Forms
                        </span>
                      ) : null}
                    </div>

                    <p className="text-xs text-slate-600">Code: {registration.registrationCode}</p>

                    <p className="text-sm text-slate-700">
                      Checked-in attendees: <span className="font-semibold">{registration.checkedInCount}</span> /{" "}
                      <span className="font-semibold">{registration.attendees.length}</span>
                    </p>

                    {registration.hasMissingRequiredFields ? (
                      <ul className="list-disc space-y-1 pl-5 text-xs text-rose-700">
                        {registration.missingRequiredFields.map((missingField) => (
                          <li key={`${registration.id}-${missingField}`}>{missingField}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>

                  <form action={markRegistrationCheckedIn} className="mt-4 md:mt-0">
                    <input type="hidden" name="eventId" value={event.id} readOnly />
                    <input type="hidden" name="registrationId" value={registration.id} readOnly />
                    <button
                      type="submit"
                      className="w-full rounded-lg bg-indigo-600 px-5 py-3 text-base font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300 md:w-auto"
                      disabled={registration.attendees.length === 0 || fullyCheckedIn}
                    >
                      {registration.attendees.length === 0
                        ? "No Attendees"
                        : fullyCheckedIn
                          ? "Checked-In"
                          : "Mark Checked-In"}
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </article>
    </section>
  );
}
