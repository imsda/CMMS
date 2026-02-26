import Link from "next/link";

import { auth } from "../../../auth";
import { prisma } from "../../../lib/prisma";

function formatDateRange(startsAt: Date, endsAt: Date) {
  const dayFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${dayFormatter.format(startsAt)} • ${timeFormatter.format(startsAt)} - ${timeFormatter.format(endsAt)}`;
}

export default async function TeacherDashboardPage() {
  const session = await auth();

  if (!session?.user || session.user.role !== "STAFF_TEACHER") {
    throw new Error("Only teachers can access this dashboard.");
  }

  const offerings = await prisma.eventClassOffering.findMany({
    where: {
      instructorUserId: session.user.id,
      startsAt: {
        gte: new Date(),
      },
    },
    select: {
      id: true,
      dayIndex: true,
      startsAt: true,
      endsAt: true,
      location: true,
      capacity: true,
      _count: {
        select: {
          enrollments: true,
        },
      },
      event: {
        select: {
          id: true,
          name: true,
        },
      },
      classCatalog: {
        select: {
          title: true,
          code: true,
        },
      },
    },
    orderBy: [{ startsAt: "asc" }, { classCatalog: { title: "asc" } }],
  });

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Teacher Portal</p>
        <h1 className="text-3xl font-semibold text-slate-900">My Upcoming Class Sessions</h1>
        <p className="mt-2 text-sm text-slate-600">
          Manage attendance and sign-off requirements for classes you are assigned to teach.
        </p>
      </header>

      {offerings.length === 0 ? (
        <article className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          You do not have any upcoming class sessions assigned right now.
        </article>
      ) : (
        <div className="grid gap-4">
          {offerings.map((offering) => {
            const enrolledCount = offering._count.enrollments;
            return (
              <article
                key={offering.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-indigo-600">{offering.event.name}</p>
                    <h2 className="mt-1 text-xl font-semibold text-slate-900">
                      {offering.classCatalog.title}
                      <span className="ml-2 text-sm font-medium text-slate-500">
                        ({offering.classCatalog.code})
                      </span>
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Day {offering.dayIndex + 1} • {formatDateRange(offering.startsAt, offering.endsAt)}
                    </p>
                    <p className="text-sm text-slate-500">{offering.location ?? "Location TBD"}</p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-700">
                      {enrolledCount}/{offering.capacity} enrolled
                    </p>
                    <Link
                      href={`/teacher/class/${offering.id}`}
                      className="mt-2 inline-flex rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
                    >
                      Open Roster
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
