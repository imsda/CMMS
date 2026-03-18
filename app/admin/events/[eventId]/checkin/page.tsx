import Link from "next/link";
import { notFound } from "next/navigation";

import { getEventCheckinDashboard } from "../../../../actions/checkin-actions";
import { AdminPageHeader } from "../../../_components/admin-page-header";
import { CheckinClient } from "./checkin-client";

type CheckinPageProps = {
  params: Promise<{
    eventId: string;
  }>;
};

function formatEventDateRange(startsAt: Date, endsAt: Date) {
  return `${startsAt.toLocaleDateString()} - ${endsAt.toLocaleDateString()}`;
}

export default async function EventCheckinPage({ params }: CheckinPageProps) {
  const { eventId } = await params;
  const event = await getEventCheckinDashboard(eventId);

  if (!event) {
    notFound();
  }

  // Serialize registrations for the client component (Date → string conversion is safe; client only checks null/non-null)
  const registrations = event.registrations.map((reg) => ({
    id: reg.id,
    registrationCode: reg.registrationCode,
    status: reg.status,
    checkedInCount: reg.checkedInCount,
    hasMissingRequiredFields: reg.hasMissingRequiredFields,
    missingRequiredFields: reg.missingRequiredFields,
    club: reg.club,
    attendees: reg.attendees.map((a) => ({
      id: a.id,
      checkedInAt: a.checkedInAt ? a.checkedInAt.toISOString() : null,
      rosterMemberId: a.rosterMemberId,
      rosterMember: {
        firstName: a.rosterMember.firstName,
        lastName: a.rosterMember.lastName,
        memberRole: a.rosterMember.memberRole,
      },
    })),
  }));

  return (
    <section className="space-y-6">
      <AdminPageHeader
        eyebrow="On-Site Gate Check-in"
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Events", href: "/admin/events" },
          { label: event.name, href: `/admin/events/${event.id}` },
          { label: "Check-in" },
        ]}
        title={event.name}
        description={formatEventDateRange(event.startsAt, event.endsAt)}
        secondaryActions={
          <>
            <Link href={`/admin/events/${event.id}`} className="btn-secondary">
              Event Overview
            </Link>
            <Link href="/admin/dashboard" className="btn-secondary">
              Back to Dashboard
            </Link>
          </>
        }
      />

      <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <h2 className="text-xl font-semibold text-slate-900">Registration Check-in</h2>
        <p className="mt-1 text-sm text-slate-600">
          Search attendees by name or club, check in individuals or entire clubs. Use &ldquo;Scan QR&rdquo; to scan
          attendee QR codes from the event registration PDF.
        </p>

        {event.registrations.length === 0 ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            No clubs have started registration for this event.
          </p>
        ) : (
          <div className="mt-4">
            <CheckinClient
              eventId={event.id}
              eventName={event.name}
              registrations={registrations}
            />
          </div>
        )}
      </article>
    </section>
  );
}
