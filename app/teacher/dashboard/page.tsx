import Link from "next/link";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";

import { auth } from "../../../auth";
import { prisma } from "../../../lib/prisma";
import { canAccessTeacherPortal } from "../../../lib/teacher-portal";

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

  if (!session?.user || !canAccessTeacherPortal(session.user.role)) {
    redirect("/login");
  }

  const offerings = await prisma.eventClassOffering.findMany({
    where: {
      ...(session.user.role === UserRole.SUPER_ADMIN
        ? {}
        : {
            teacherUserId: session.user.id,
          }),
      event: {
        endsAt: {
          gte: new Date(),
        },
      },
    },
    select: {
      id: true,
      capacity: true,
      _count: {
        select: {
          enrollments: true,
        },
      },
      enrollments: {
        select: {
          attendedAt: true,
        },
      },
      event: {
        select: {
          id: true,
          name: true,
          startsAt: true,
          endsAt: true,
          locationName: true,
        },
      },
      classCatalog: {
        select: {
          title: true,
          code: true,
        },
      },
      teacher: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: [{ event: { startsAt: "asc" } }, { classCatalog: { title: "asc" } }],
  });

  return (
    <section className="space-y-6">
      <header className="glass-panel">
        <p className="hero-kicker">Teacher Portal</p>
        <h1 className="hero-title mt-3">
          {session.user.role === UserRole.SUPER_ADMIN ? "Teacher Class Oversight" : "My Event Class Assignments"}
        </h1>
        <p className="hero-copy">
          {session.user.role === UserRole.SUPER_ADMIN
            ? "Review any upcoming class roster, attendance, and honor sign-off workflow as Super Admin."
            : "Manage attendance and sign-off requirements for the event classes assigned to you."}
        </p>
      </header>

      {offerings.length === 0 ? (
        <article className="empty-state text-sm text-slate-600">
          {session.user.role === UserRole.SUPER_ADMIN
            ? "No upcoming event class offerings are available right now."
            : "You do not have any upcoming event class assignments right now."}
        </article>
      ) : (
        <div className="grid gap-4">
          {offerings.map((offering) => {
            const enrolledCount = offering._count.enrollments;
            const attendedCount = offering.enrollments.filter(
              (enrollment) => enrollment.attendedAt !== null,
            ).length;
            return (
              <article
                key={offering.id}
                className="glass-card"
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
                    <p className="mt-1 text-sm font-medium text-slate-700">
                      Event dates
                    </p>
                    <p className="text-sm text-slate-600">
                      {formatDateRange(offering.event.startsAt, offering.event.endsAt)}
                    </p>
                    <p className="text-sm text-slate-500">{offering.event.locationName ?? "Location TBD"}</p>
                    {session.user.role === UserRole.SUPER_ADMIN ? (
                      <p className="mt-2 text-sm text-slate-500">
                        Teacher: {offering.teacher?.name ?? offering.teacher?.email ?? "Unassigned"}
                      </p>
                    ) : null}
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-700">
                      {enrolledCount}/{offering.capacity ?? "Open"} enrolled
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Class attendance marked: {attendedCount}/{enrolledCount}
                    </p>
                    <Link
                      href={`/teacher/class/${offering.id}`}
                      className="btn-primary mt-3"
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
