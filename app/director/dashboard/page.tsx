import Link from "next/link";
import { MemberRole, RegistrationStatus } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "../../../auth";
import { prisma } from "../../../lib/prisma";

function formatDateRange(startsAt: Date, endsAt: Date) {
  return `${startsAt.toLocaleDateString()} - ${endsAt.toLocaleDateString()}`;
}

export default async function ClubDirectorDashboardPage() {
  const session = await auth();

  if (!session?.user || session.user.role !== "CLUB_DIRECTOR") {
    redirect("/login");
  }

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
        <p className="mt-2 text-sm">This account must be linked to a club before dashboard workflows can run.</p>
      </section>
    );
  }

  const activeRoster = membership.club.rosterYears[0] ?? null;
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
        clubId: membership.club.id,
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Club Director Dashboard</p>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900">{membership.club.name}</h2>
          <p className="mt-1 text-sm text-slate-600">
            Manage roster readiness, event registrations, and class workflows from one place.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/director/roster"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-indigo-300 hover:text-indigo-700"
          >
            View roster
          </Link>
          <Link
            href="/director/events"
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
          >
            Continue registration
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Active members</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{activeMembers.length}</p>
          <p className="mt-2 text-xs font-medium text-slate-600">Current active roster year.</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Upcoming events</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{upcomingEvents.length}</p>
          <p className="mt-2 text-xs font-medium text-slate-600">Conference events open or upcoming.</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Submitted registrations</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{submittedRegistrations}</p>
          <p className="mt-2 text-xs font-medium text-slate-600">Finalized by your club.</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Draft registrations</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{draftRegistrations}</p>
          <p className="mt-2 text-xs font-medium text-slate-600">In progress and editable.</p>
        </article>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Upcoming Events</h3>
            <Link
              href="/director/events"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700"
            >
              Open Event List
            </Link>
          </div>

          {upcomingEvents.length === 0 ? (
            <p className="text-sm text-slate-600">No upcoming events are available at this time.</p>
          ) : (
            <ol className="space-y-3">
              {upcomingEvents.map((event) => {
                const registration = registrationByEventId.get(event.id);

                return (
                  <li
                    key={event.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
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

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Action Alerts</h3>
          {alerts.length === 0 ? (
            <p className="mt-4 text-sm text-emerald-700">No blocking alerts detected.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {alerts.map((alert) => (
                <li
                  key={alert}
                  className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
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
