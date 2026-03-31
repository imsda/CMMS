import { headers } from "next/headers";
import Link from "next/link";

import { prisma } from "../../../lib/prisma";
import {
  checkPublicPageRateLimit,
  getClientIpFromHeaders,
} from "../../../lib/public-page-rate-limit";

export const dynamic = "force-dynamic";

function formatDateRange(startsAt: Date, endsAt: Date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return `${fmt.format(startsAt)} – ${fmt.format(endsAt)}`;
}

function formatRegistrationWindow(opensAt: Date, closesAt: Date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${fmt.format(opensAt)} – ${fmt.format(closesAt)}`;
}

function eventModeLabel(mode: string) {
  const labels: Record<string, string> = {
    BASIC_FORM: "General Event",
    CLUB_REGISTRATION: "Club Registration",
    CLASS_ASSIGNMENT: "Honors Weekend",
  };
  return labels[mode] ?? mode;
}

export default async function PublicEventsPage() {
  const reqHeaders = await headers();
  const ip = getClientIpFromHeaders(reqHeaders);
  const allowed = await checkPublicPageRateLimit(ip);

  if (!allowed) {
    return (
      <section className="glass-panel mx-auto max-w-3xl text-center">
        <h1 className="hero-title">Too Many Requests</h1>
        <p className="hero-copy mt-3">
          You have made too many requests. Please wait a few minutes and try
          again.
        </p>
      </section>
    );
  }

  const now = new Date();

  const events = await prisma.event.findMany({
    where: {
      isPublished: true,
      endsAt: { gte: now },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      startsAt: true,
      endsAt: true,
      registrationOpensAt: true,
      registrationClosesAt: true,
      locationName: true,
      locationAddress: true,
      eventMode: true,
      allowedClubTypes: true,
    },
    orderBy: { startsAt: "asc" },
  });

  return (
    <section className="space-y-6">
      <header className="glass-panel">
        <p className="hero-kicker">Conference Events</p>
        <h1 className="hero-title mt-3">Upcoming Events</h1>
        <p className="hero-copy">
          Browse upcoming conference events. Sign in to register your club.
        </p>
        <div className="mt-4">
          <Link href="/login" className="btn-primary">
            Sign In to Register
          </Link>
        </div>
      </header>

      {events.length === 0 ? (
        <article className="glass-panel text-center">
          <p className="text-slate-600">
            No upcoming events are currently published. Check back soon.
          </p>
        </article>
      ) : (
        <div className="grid gap-6">
          {events.map((event) => {
            const registrationOpen =
              now >= event.registrationOpensAt &&
              now <= event.registrationClosesAt;
            const registrationSoon = now < event.registrationOpensAt;

            return (
              <article
                key={event.id}
                id={event.slug}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex rounded-full bg-indigo-100 px-3 py-0.5 text-xs font-semibold text-indigo-700">
                        {eventModeLabel(event.eventMode)}
                      </span>
                      {registrationOpen ? (
                        <span className="inline-flex rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-semibold text-emerald-700">
                          Registration Open
                        </span>
                      ) : registrationSoon ? (
                        <span className="inline-flex rounded-full bg-amber-100 px-3 py-0.5 text-xs font-semibold text-amber-700">
                          Registration Opens Soon
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-slate-100 px-3 py-0.5 text-xs font-semibold text-slate-600">
                          Registration Closed
                        </span>
                      )}
                    </div>
                    <h2 className="mt-2 text-xl font-semibold text-slate-900">
                      {event.name}
                    </h2>
                    {event.description ? (
                      <p className="mt-1 text-sm text-slate-600">
                        {event.description}
                      </p>
                    ) : null}
                  </div>
                </div>

                <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Dates
                    </dt>
                    <dd className="mt-1 text-sm text-slate-800">
                      {formatDateRange(event.startsAt, event.endsAt)}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Location
                    </dt>
                    <dd className="mt-1 text-sm text-slate-800">
                      {event.locationName ?? "TBD"}
                      {event.locationAddress ? (
                        <span className="block text-xs text-slate-500">
                          {event.locationAddress}
                        </span>
                      ) : null}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Registration Window
                    </dt>
                    <dd className="mt-1 text-sm text-slate-800">
                      {formatRegistrationWindow(
                        event.registrationOpensAt,
                        event.registrationClosesAt,
                      )}
                    </dd>
                  </div>

                  {event.allowedClubTypes.length > 0 ? (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Open To
                      </dt>
                      <dd className="mt-1 text-sm text-slate-800">
                        {event.allowedClubTypes
                          .map((t) =>
                            t === "PATHFINDER"
                              ? "Pathfinder"
                              : t === "ADVENTURER"
                                ? "Adventurer"
                                : t === "EAGER_BEAVER"
                                  ? "Eager Beaver"
                                  : t,
                          )
                          .join(", ")}
                      </dd>
                    </div>
                  ) : (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Open To
                      </dt>
                      <dd className="mt-1 text-sm text-slate-800">
                        All Clubs
                      </dd>
                    </div>
                  )}
                </dl>

                <div className="mt-4 border-t border-slate-100 pt-4">
                  <Link
                    href="/login"
                    className="text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    Sign in to register your club →
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
