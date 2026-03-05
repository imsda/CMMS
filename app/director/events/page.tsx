import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "../../../auth";
import { prisma } from "../../../lib/prisma";

export default async function DirectorEventsPage() {
  const session = await auth();

  if (!session?.user || session.user.role !== "CLUB_DIRECTOR") {
    redirect("/login");
  }

  const membership = await prisma.clubMembership.findFirst({
    where: {
      userId: session.user.id,
    },
    select: {
      clubId: true,
    },
    orderBy: {
      isPrimary: "desc",
    },
  });

  if (!membership) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <h1 className="text-xl font-semibold">No club membership found</h1>
        <p className="mt-2 text-sm">This account must be linked to a club before event registration can begin.</p>
      </section>
    );
  }

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
          clubId: membership.clubId,
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
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Club Director</p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-900">Event Registration</h1>
        <p className="mt-2 text-sm text-slate-600">
          Open an event to select attendees, complete dynamic forms, and submit your club registration.
        </p>
      </header>

      {events.length === 0 ? (
        <article className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          No upcoming events are currently available.
        </article>
      ) : (
        <div className="grid gap-4">
          {events.map((event) => {
            const registration = event.registrations[0];

            return (
              <article key={event.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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
                    href={`/director/events/${event.id}`}
                    className="inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
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
