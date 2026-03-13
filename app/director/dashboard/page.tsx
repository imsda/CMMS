import Link from "next/link";
import { MemberRole, RegistrationStatus } from "@prisma/client";

import { getManagedClubContext } from "../../../lib/club-management";
import { buildDirectorPath } from "../../../lib/director-path";
import { prisma } from "../../../lib/prisma";

function formatDateRange(startsAt: Date, endsAt: Date) {
  return `${startsAt.toLocaleDateString()} - ${endsAt.toLocaleDateString()}`;
}

export default async function ClubDirectorDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ clubId?: string }>;
}) {
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
            select: {
              id: true,
              firstName: true,
              lastName: true,
              memberRole: true,
              backgroundCheckCleared: true,
            },
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
        <p className="mt-2 text-sm">The selected club could not be loaded for dashboard workflows.</p>
      </section>
    );
  }

  const activeRoster = club.rosterYears[0] ?? null;
  const activeMembers = activeRoster?.members ?? [];

  const [upcomingEvents, clubRegistrations] = await Promise.all([
    prisma.event.findMany({
      where: {
        endsAt: {
          gte: new Date(),
        },
      },
      select: {
        id: true,
        name: true,
        startsAt: true,
        endsAt: true,
      },
      orderBy: {
        startsAt: "asc",
      },
      take: 4,
    }),
    prisma.eventRegistration.findMany({
      where: {
        clubId: club.id,
      },
      select: {
        eventId: true,
        status: true,
        _count: {
          select: {
            attendees: true,
          },
        },
      },
    }),
  ]);

  const registrationByEventId = new Map(clubRegistrations.map((registration) => [registration.eventId, registration]));

  const submittedRegistrations = clubRegistrations.filter(
    (registration) => registration.status === RegistrationStatus.SUBMITTED,
  ).length;

  const draftRegistrations = clubRegistrations.filter(
    (registration) => registration.status === RegistrationStatus.DRAFT,
  ).length;

  const staffMissingClearance = activeMembers.filter(
    (member) =>
      (member.memberRole === MemberRole.STAFF || member.memberRole === MemberRole.DIRECTOR) &&
      !member.backgroundCheckCleared,
  );

  const alerts: string[] = [];

  if (!activeRoster) {
    alerts.push("No active roster year found. Run annual rollover before event registration.");
  }

  if (staffMissingClearance.length > 0) {
    alerts.push(
      `${staffMissingClearance.length} staff/director member(s) are missing Sterling clearance and can block submissions.`,
    );
  }

  if (upcomingEvents.length === 0) {
    alerts.push("No upcoming events are currently published by conference administration.");
  }

  return (
    <section className="space-y-8">
      <div className="glass-panel flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="hero-kicker">Club Director Dashboard</p>
          <h2 className="hero-title mt-3">{club.name}</h2>
          <p className="hero-copy">
            Manage roster readiness, event registrations, and class workflows from one place.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href={buildDirectorPath("/director/roster", managedClub.clubId, managedClub.isSuperAdmin)}
            className="btn-secondary"
          >
            View roster
          </Link>
          <Link
            href={buildDirectorPath("/director/events", managedClub.clubId, managedClub.isSuperAdmin)}
            className="btn-primary"
          >
            Continue registration
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="metric-card">
          <p className="metric-label">Active members</p>
          <p className="metric-value">{activeMembers.length}</p>
          <p className="metric-caption">Current active roster year.</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Upcoming events</p>
          <p className="metric-value">{upcomingEvents.length}</p>
          <p className="metric-caption">Conference events open or upcoming.</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Submitted registrations</p>
          <p className="metric-value">{submittedRegistrations}</p>
          <p className="metric-caption">Finalized by your club.</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Draft registrations</p>
          <p className="metric-value">{draftRegistrations}</p>
          <p className="metric-caption">In progress and editable.</p>
        </article>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="glass-panel">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="section-title">Upcoming Events</h3>
            <Link
              href={buildDirectorPath("/director/events", managedClub.clubId, managedClub.isSuperAdmin)}
              className="btn-secondary px-3 py-1.5 text-xs"
            >
              Open Event List
            </Link>
          </div>

          {upcomingEvents.length === 0 ? (
            <p className="empty-state text-sm text-slate-600">No upcoming events are available at this time.</p>
          ) : (
            <ol className="space-y-3">
              {upcomingEvents.map((event) => {
                const registration = registrationByEventId.get(event.id);

                return (
                  <li
                    key={event.id}
                    className="glass-card-soft flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{event.name}</p>
                      <p className="text-xs text-slate-600">{formatDateRange(event.startsAt, event.endsAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-slate-700">
                        {registration?.status ?? "NOT STARTED"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {registration?._count.attendees ?? 0} attendee(s)
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </article>

        <article className="glass-panel">
          <h3 className="section-title">Action Alerts</h3>
          {alerts.length === 0 ? (
            <p className="alert-success mt-4">No blocking alerts detected.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {alerts.map((alert) => (
                <li
                  key={alert}
                  className="alert-warning"
                >
                  {alert}
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </section>
  );
}
