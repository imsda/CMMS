import { notFound } from "next/navigation";

import { auth } from "../../../../auth";
import { prisma } from "../../../../lib/prisma";
import { ClassRosterManager } from "./_components/class-roster-manager";

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

export default async function TeacherClassRosterPage({
  params,
}: {
  params: Promise<{ offeringId: string }>;
}) {
  const session = await auth();

  if (!session?.user || session.user.role !== "STAFF_TEACHER") {
    throw new Error("Only teachers can access class rosters.");
  }

  const { offeringId } = await params;

  const offering = await prisma.eventClassOffering.findFirst({
    where: {
      id: offeringId,
      instructorUserId: session.user.id,
    },
    select: {
      id: true,
      dayIndex: true,
      startsAt: true,
      endsAt: true,
      location: true,
      capacity: true,
      eventId: true,
      classCatalog: {
        select: {
          title: true,
          code: true,
        },
      },
      event: {
        select: {
          name: true,
        },
      },
      _count: {
        select: {
          enrollments: true,
        },
      },
    },
  });

  if (!offering) {
    notFound();
  }

  const students = await prisma.classEnrollment.findMany({
    where: {
      eventClassOfferingId: offering.id,
    },
    select: {
      rosterMemberId: true,
      rosterMember: {
        select: {
          firstName: true,
          lastName: true,
          memberRole: true,
          registrations: {
            where: {
              eventRegistration: {
                eventId: offering.eventId,
              },
            },
            select: {
              checkedInAt: true,
            },
            take: 1,
          },
          completedRequirements: {
            where: {
              honorCode: offering.classCatalog.code,
            },
            select: {
              id: true,
            },
            take: 1,
          },
        },
      },
    },
    orderBy: {
      rosterMember: {
        lastName: "asc",
      },
    },
  });

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Class Management</p>
        <h1 className="text-3xl font-semibold text-slate-900">
          {offering.classCatalog.title}
          <span className="ml-2 text-sm font-medium text-slate-500">({offering.classCatalog.code})</span>
        </h1>
        <p className="mt-2 text-sm text-slate-600">{offering.event.name}</p>
        <p className="text-sm text-slate-600">
          Day {offering.dayIndex + 1} • {formatDateRange(offering.startsAt, offering.endsAt)}
        </p>
        <p className="text-sm text-slate-500">{offering.location ?? "Location TBD"}</p>
      </header>

      <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-medium text-slate-700">
          Enrollment: {offering._count.enrollments}/{offering.capacity}
        </p>
      </article>

      <ClassRosterManager
        offeringId={offering.id}
        honorCode={offering.classCatalog.code}
        students={students.map((student) => ({
          rosterMemberId: student.rosterMemberId,
          name: `${student.rosterMember.firstName} ${student.rosterMember.lastName}`,
          memberRole: student.rosterMember.memberRole.replaceAll("_", " "),
          checkedInAt: student.rosterMember.registrations[0]?.checkedInAt
            ? student.rosterMember.registrations[0].checkedInAt.toISOString()
            : null,
          alreadyCompleted: student.rosterMember.completedRequirements.length > 0,
        }))}
      />
    </section>
  );
}
