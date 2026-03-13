import { notFound } from "next/navigation";

import { getManagedClubContext } from "../../../../lib/club-management";
import { getRegistrationLifecycleState } from "../../../../lib/registration-lifecycle";
import { prisma } from "../../../../lib/prisma";
import { RegistrationFormFulfiller } from "./_components/registration-form-fulfiller";

function formatDateRange(startsAt: Date, endsAt: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return `${formatter.format(startsAt)} - ${formatter.format(endsAt)}`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export default async function DirectorEventRegistrationPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams?: Promise<{ clubId?: string }>;
}) {
  const { eventId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const managedClub = await getManagedClubContext(resolvedSearchParams?.clubId ?? null);

  const club = await prisma.club.findUnique({
    where: {
      id: managedClub.clubId,
    },
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
  });

  if (!club) {
    return (
      <section className="glass-panel">
        <h1 className="text-xl font-semibold">Club not found</h1>
        <p className="mt-2 text-sm">The selected club could not be loaded before registering for events.</p>
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
          clubId: club.id,
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
  const activeRoster = club.rosterYears[0];
  const attendees = activeRoster?.members ?? [];
  const attendeeCount = registration?.attendees.length ?? 0;
  const inLateFeeWindow = new Date() >= event.lateFeeStartsAt;
  const currentPricePerAttendee = inLateFeeWindow ? event.lateFeePrice : event.basePrice;
  const estimatedTotal = attendeeCount * currentPricePerAttendee;
  const lifecycleState = getRegistrationLifecycleState({
    registrationOpensAt: event.registrationOpensAt,
    registrationClosesAt: event.registrationClosesAt,
    registrationStatus: registration?.status ?? null,
  });

  return (
    <section className="space-y-6">
      <header className="glass-panel">
        <p className="hero-kicker">Event Registration</p>
        <h1 className="hero-title mt-3">{event.name}</h1>
        <p className="hero-copy">{event.description ?? "No additional description provided."}</p>

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
          <div>
            <dt className="font-semibold text-slate-900">Current Price / Attendee</dt>
            <dd>{formatCurrency(currentPricePerAttendee)}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-900">Estimated Total</dt>
            <dd>{formatCurrency(estimatedTotal)} ({attendeeCount} attendee{attendeeCount === 1 ? "" : "s"})</dd>
          </div>
        </dl>
      </header>

      <RegistrationFormFulfiller
        eventId={event.id}
        managedClubId={managedClub.isSuperAdmin ? managedClub.clubId : null}
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
          fieldScope: field.fieldScope,
          isRequired: field.isRequired,
          options: field.options,
          parentFieldId: field.parentFieldId,
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
        canEditRegistration={lifecycleState.canEdit}
        registrationNotice={lifecycleState.message}
      />
    </section>
  );
}
