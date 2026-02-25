import { notFound } from "next/navigation";

import { auth } from "../../../../auth";
import { prisma } from "../../../../lib/prisma";
import { RegistrationFormFulfiller } from "./_components/registration-form-fulfiller";

function formatDateRange(startsAt: Date, endsAt: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return `${formatter.format(startsAt)} - ${formatter.format(endsAt)}`;
}

export default async function DirectorEventRegistrationPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const session = await auth();

  if (!session?.user || session.user.role !== "CLUB_DIRECTOR") {
    throw new Error("Only club directors can register for events.");
  }

  const { eventId } = await params;

  const membership = await prisma.clubMembership.findFirst({
    where: {
      userId: session.user.id,
    },
    include: {
      club: {
        include: {
          rosterYears: {
            where: {
              isActive: true,
            },
            include: {
              members: {
                where: {
                  isActive: true,
                },
                orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
              },
            },
            orderBy: {
              startsOn: "desc",
            },
            take: 1,
          },
        },
      },
    },
    orderBy: {
      isPrimary: "desc",
    },
  });

  if (!membership?.club) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <h1 className="text-xl font-semibold">No club membership found</h1>
        <p className="mt-2 text-sm">You need an active club membership before registering for events.</p>
      </section>
    );
  }

  const event = await prisma.event.findUnique({
    where: {
      id: eventId,
    },
    include: {
      dynamicFields: {
        orderBy: {
          sortOrder: "asc",
        },
      },
      registrations: {
        where: {
          clubId: membership.club.id,
        },
        include: {
          attendees: {
            select: {
              rosterMemberId: true,
            },
          },
          formResponses: {
            select: {
              attendeeId: true,
              eventFormFieldId: true,
              value: true,
            },
          },
        },
        take: 1,
      },
    },
  });

  if (!event) {
    notFound();
  }

  const registration = event.registrations[0] ?? null;
  const activeRoster = membership.club.rosterYears[0];
  const attendees = activeRoster?.members ?? [];

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Event Registration</p>
        <h1 className="text-3xl font-semibold text-slate-900">{event.name}</h1>
        <p className="mt-2 text-sm text-slate-600">{event.description ?? "No additional description provided."}</p>

        <dl className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
          <div>
            <dt className="font-semibold text-slate-900">When</dt>
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
      </header>

      <RegistrationFormFulfiller
        eventId={event.id}
        attendees={attendees.map((member) => ({
          id: member.id,
          firstName: member.firstName,
          lastName: member.lastName,
          memberRole: member.memberRole,
        }))}
        dynamicFields={event.dynamicFields.map((field) => ({
          id: field.id,
          key: field.key,
          label: field.label,
          description: field.description,
          type: field.type,
          isRequired: field.isRequired,
          options: field.options,
        }))}
        initialSelectedAttendeeIds={registration?.attendees.map((attendee) => attendee.rosterMemberId) ?? []}
        initialResponses={
          registration?.formResponses.map((response) => ({
            fieldId: response.eventFormFieldId,
            attendeeId: response.attendeeId,
            value: response.value,
          })) ?? []
        }
        registrationStatus={registration?.status ?? null}
      />
    </section>
  );
}
