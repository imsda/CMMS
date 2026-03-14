import { notFound, redirect } from "next/navigation";

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
    redirect("/login");
  }

  const { offeringId } = await params;

  const offering = await prisma.eventClassOffering.findFirst({
    where: {
      id: offeringId,
      teacherUserId: session.user.id,
    },
    select: {
      id: true,
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
          startsAt: true,
          endsAt: true,
          locationName: true,
        },
      },
      timeslot: {
        select: {
          label: true,
          startsAt: true,
          endsAt: true,
        },
      },
      locationName: true,
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
      attendedAt: true,
      rosterMemberId: true,
      rosterMember: {
        select: {
          firstName: true,
          lastName: true,
          memberRole: true,
          completedRequirements: {
            where: {
              requirementType: "COMPLETED_HONOR",
              metadata: {
                path: ["honorCode"],
                equals: offering.classCatalog.code,
              },
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
      <header className="glass-panel">
        <p className="hero-kicker">Class Management</p>
        <h1 className="hero-title mt-3">
          {offering.classCatalog.title}
          <span className="ml-2 text-sm font-medium text-slate-500">({offering.classCatalog.code})</span>
        </h1>
        <p className="mt-2 text-sm text-slate-600">{offering.event.name}</p>
        <p className="text-sm font-medium text-slate-700">Event dates</p>
        <p className="text-sm text-slate-600">
          {formatDateRange(offering.event.startsAt, offering.event.endsAt)}
        </p>
        <p className="text-sm text-slate-500">
          {offering.timeslot
            ? `${offering.timeslot.label} • ${formatDateRange(offering.timeslot.startsAt, offering.timeslot.endsAt)}`
            : "Timeslot TBD"}
        </p>
        <p className="text-sm text-slate-500">{offering.locationName ?? offering.event.locationName ?? "Location TBD"}</p>
      </header>

      <article className="glass-card">
        <p className="text-sm font-medium text-slate-700">
          Enrollment: {offering._count.enrollments}/{offering.capacity ?? "Open"}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Attendance marked: {students.filter((student) => student.attendedAt !== null).length}/{students.length}
        </p>
      </article>

      <ClassRosterManager
        offeringId={offering.id}
        honorCode={offering.classCatalog.code}
        students={students.map((student) => ({
          rosterMemberId: student.rosterMemberId,
          name: `${student.rosterMember.firstName} ${student.rosterMember.lastName}`,
          memberRole: student.rosterMember.memberRole.replaceAll("_", " "),
          attendedAt: student.attendedAt
            ? student.attendedAt.toISOString()
            : null,
          alreadyCompleted: student.rosterMember.completedRequirements.length > 0,
        }))}
      />
    </section>
  );
}
