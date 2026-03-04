import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "../../../../../../lib/prisma";

function formatDateRange(startsAt: Date, endsAt: Date) {
  return `${startsAt.toLocaleDateString()} - ${endsAt.toLocaleDateString()}`;
}

function csvEscape(value: string) {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replaceAll("\"", "\"\"")}"`;
  }

  return value;
}

type CompliancePageProps = {
  params: Promise<{
    eventId: string;
  }>;
};

export default async function EventComplianceReportPage({ params }: CompliancePageProps) {
  const { eventId } = await params;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      name: true,
      startsAt: true,
      endsAt: true,
    },
  });

  if (!event) {
    notFound();
  }

  const flaggedAttendees = await prisma.registrationAttendee.findMany({
    where: {
      eventRegistration: {
        eventId,
      },
      rosterMember: {
        memberRole: {
          in: ["STAFF", "DIRECTOR", "COUNSELOR"],
        },
        backgroundCheckCleared: false,
      },
    },
    select: {
      id: true,
      rosterMember: {
        select: {
          firstName: true,
          lastName: true,
          memberRole: true,
          backgroundCheckCleared: true,
        },
      },
      eventRegistration: {
        select: {
          status: true,
          club: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: [
      {
        eventRegistration: {
          club: {
            name: "asc",
          },
        },
      },
      {
        rosterMember: {
          lastName: "asc",
        },
      },
      {
        rosterMember: {
          firstName: "asc",
        },
      },
    ],
  });

  const csvRows = flaggedAttendees.map((attendee) => {
    const fullName = `${attendee.rosterMember.firstName} ${attendee.rosterMember.lastName}`;
    const registrationStatus = attendee.eventRegistration.status === "DRAFT" ? "Draft" : "Submitted";

    return [
      attendee.eventRegistration.club.name,
      fullName,
      attendee.rosterMember.memberRole,
      registrationStatus,
      "Action Required: Missing Clearance",
    ];
  });

  const csvContent = [
    ["Club Name", "Attendee Name", "Role", "Registration Status", "Compliance Flag"].join(","),
    ...csvRows.map((row) => row.map(csvEscape).join(",")),
  ].join("\n");

  const csvHref = `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`;
  const csvFileName = `${event.name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}-missing-clearance.csv`;

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Event Reports</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Event Compliance Flagging Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">
          Adults in leadership/staff roles who are registered for this event but still missing Sterling Volunteers clearance.
        </p>

        <dl className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
          <div>
            <dt className="font-semibold text-slate-900">Event</dt>
            <dd>{event.name}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-900">Event Dates</dt>
            <dd>{formatDateRange(event.startsAt, event.endsAt)}</dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <a
            href={csvHref}
            download={csvFileName}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500"
          >
            Download List
          </a>
          <Link
            href={`/admin/events/${eventId}`}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700"
          >
            Back to Event
          </Link>
        </div>
      </header>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Flagged Attendees</h2>
        <p className="mt-1 text-sm text-slate-600">
          Grouped by club name to streamline outreach to Club Directors.
        </p>

        {flaggedAttendees.length === 0 ? (
          <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Great news — all STAFF, DIRECTOR, and COUNSELOR attendees currently have cleared background checks.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3">Club Name</th>
                  <th className="px-4 py-3">Attendee Name</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Registration Status</th>
                  <th className="px-4 py-3">Compliance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {flaggedAttendees.map((attendee) => {
                  const fullName = `${attendee.rosterMember.firstName} ${attendee.rosterMember.lastName}`;
                  const registrationStatus = attendee.eventRegistration.status === "DRAFT" ? "Draft" : "Submitted";

                  return (
                    <tr key={attendee.id} className="align-top">
                      <td className="px-4 py-3 font-medium text-slate-900">{attendee.eventRegistration.club.name}</td>
                      <td className="px-4 py-3 text-slate-900">{fullName}</td>
                      <td className="px-4 py-3 text-slate-700">{attendee.rosterMember.memberRole}</td>
                      <td className="px-4 py-3 text-slate-700">{registrationStatus}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-rose-700">
                          Action Required: Missing Clearance
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}
