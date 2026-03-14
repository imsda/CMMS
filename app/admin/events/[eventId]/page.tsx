import Link from "next/link";
import { notFound } from "next/navigation";

import { getCamporeeDashboardData } from "../../../actions/camporee-actions";
import {
  getAdminEventRegistrations,
  getMasterEventAttendeesCsv,
} from "../../../actions/admin-actions";
import { getEventModeConfig } from "../../../../lib/event-modes";
import { AdminPageHeader } from "../../_components/admin-page-header";

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
  const camporeeDashboard = await getCamporeeDashboardData(eventId).catch(() => null);
  const csvHref = `data:text/csv;charset=utf-8,${encodeURIComponent(csvData.content)}`;
  const eventModeConfig = getEventModeConfig(event.eventMode);
  const workflowNotes =
    event.eventMode === "BASIC_FORM"
      ? [
          "Directors complete club-level registration without roster attendee selection.",
          "Dynamic questions should stay global to the club registration.",
        ]
      : event.eventMode === "CLASS_ASSIGNMENT"
        ? [
            "Directors register roster attendees first, then assign classes from the director workspace.",
            "Class offerings should be maintained before registration traffic increases.",
          ]
        : [
            "Directors register roster attendees and complete dynamic registration prompts.",
            "Class assignment remains optional and is not part of the primary director flow.",
          ];

  return (
    <section className="space-y-6">
      <AdminPageHeader
        eyebrow="Event Overseer"
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Events", href: "/admin/events" },
          { label: event.name },
        ]}
        title={event.name}
        description={event.description ?? "No description provided."}
        primaryAction={
          <Link href={`/admin/events/${eventId}/edit`} className="btn-primary">
            Edit Event Details
          </Link>
        }
        secondaryActions={
          <>
            {event.eventMode === "CLASS_ASSIGNMENT" ? (
              <Link href={`/admin/events/${eventId}/classes`} className="btn-secondary">
                Manage Class Offerings
              </Link>
            ) : null}
            <a href={csvHref} download={csvData.fileName} className="btn-secondary">
              Download Master Attendees CSV
            </a>
            <Link href={`/admin/events/${eventId}/reports/operational`} className="btn-secondary">
              Operational Reports
            </Link>
            <Link href={`/admin/events/${eventId}/reports/compliance`} className="btn-secondary">
              Compliance Dashboard
            </Link>
            <Link href={`/admin/events/${eventId}/camporee`} className="btn-secondary">
              Camporee Operations
            </Link>
          </>
        }
        details={
          <>
            <div>
              <dt className="font-semibold text-slate-900">Mode</dt>
              <dd>{eventModeConfig.label}</dd>
            </div>
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
          </>
        }
      />

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {eventModeConfig.description}
        </p>
        <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          <p className="font-semibold">Workflow Notes</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {workflowNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
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

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Camporee Operations & Standings</h2>
            <p className="mt-1 text-sm text-slate-600">
              Camporee now includes a guided operational registration workflow. Competition scoring remains additive and secondary.
            </p>
          </div>
          <Link
            href={`/admin/events/${eventId}/camporee`}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700"
          >
            Manage Scores
          </Link>
        </div>

        {!camporeeDashboard || camporeeDashboard.totalStandings.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No Camporee scores have been recorded for this event yet.</p>
        ) : (
          <ol className="mt-4 grid gap-3 md:grid-cols-3">
            {camporeeDashboard.totalStandings.slice(0, 3).map((standing) => (
              <li key={standing.registrationId} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rank #{standing.rank}</p>
                <p className="mt-2 text-base font-semibold text-slate-900">{standing.clubName}</p>
                <p className="text-xs text-slate-500">{standing.clubCode}</p>
                <p className="mt-3 text-2xl font-semibold text-indigo-700">{standing.totalScore}</p>
              </li>
            ))}
          </ol>
        )}
      </article>
    </section>
  );
}
