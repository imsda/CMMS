import Link from "next/link";

import { getManagedClubContext } from "../../../lib/club-management";
import { buildDirectorPath } from "../../../lib/director-path";
import { prisma } from "../../../lib/prisma";

export default async function DirectorEventsPage({
  searchParams,
}: {
  searchParams?: Promise<{ clubId?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const managedClub = await getManagedClubContext(resolvedSearchParams?.clubId ?? null);

  const events = await prisma.event.findMany({
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
      locationName: true,
      registrations: {
        where: {
          clubId: managedClub.clubId,
        },
        select: {
          status: true,
          _count: {
            select: {
              attendees: true,
            },
          },
        },
        take: 1,
      },
    },
    orderBy: {
      startsAt: "asc",
    },
  });

  return (
    <section className="space-y-6">
      <header className="glass-panel">
        <p className="hero-kicker">Club Director</p>
        <h1 className="hero-title mt-3">Event Registration</h1>
        <p className="hero-copy">
          Open an event to select attendees, complete dynamic forms, and submit your club registration.
        </p>
      </header>

      {events.length === 0 ? (
        <article className="empty-state text-sm text-slate-600">
          No upcoming events are currently available.
        </article>
      ) : (
        <div className="grid gap-4">
          {events.map((event) => {
            const registration = event.registrations[0];

            return (
              <article key={event.id} className="glass-card">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">{event.name}</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {event.startsAt.toLocaleDateString()} - {event.endsAt.toLocaleDateString()}
                    </p>
                    <p className="text-sm text-slate-500">{event.locationName ?? "Location TBD"}</p>
                    <p className="mt-2 text-sm text-slate-700">
                      Status: {registration?.status ?? "NOT STARTED"} • Attendees: {registration?._count.attendees ?? 0}
                    </p>
                  </div>

                  <Link
                    href={buildDirectorPath(`/director/events/${event.id}`, managedClub.clubId, managedClub.isSuperAdmin)}
                    className="btn-primary inline-flex"
                  >
                    Open Event
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
