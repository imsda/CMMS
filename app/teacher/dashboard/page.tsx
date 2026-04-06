import Link from "next/link";
import { redirect } from "next/navigation";
import { type Prisma } from "@prisma/client";

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

function parseRequirementConfig(config: Prisma.JsonValue) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return { minAge: null, maxAge: null, requiredMemberRole: null, requiredHonorCode: null, requiredMasterGuide: null };
  }
  const raw = config as Record<string, unknown>;
  return {
    minAge: typeof raw.minAge === "number" ? raw.minAge : null,
    maxAge: typeof raw.maxAge === "number" ? raw.maxAge : null,
    requiredMemberRole: typeof raw.requiredMemberRole === "string" ? raw.requiredMemberRole : null,
    requiredHonorCode: typeof raw.requiredHonorCode === "string" ? raw.requiredHonorCode : null,
    requiredMasterGuide: typeof raw.requiredMasterGuide === "boolean" ? raw.requiredMasterGuide : null,
  };
}

function hasPrerequisiteWarning(
  member: {
    ageAtStart: number | null;
    memberRole: string;
    masterGuide: boolean;
    completedHonorCodes: string[];
  },
  requirements: ReturnType<typeof parseRequirementConfig>[],
): string | null {
  for (const req of requirements) {
    if (req.minAge !== null && (member.ageAtStart ?? 0) < req.minAge) {
      return `Age below minimum (${req.minAge})`;
    }
    if (req.maxAge !== null && member.ageAtStart !== null && member.ageAtStart > req.maxAge) {
      return `Age above maximum (${req.maxAge})`;
    }
    if (req.requiredMemberRole && member.memberRole !== req.requiredMemberRole) {
      return `Role mismatch (needs ${req.requiredMemberRole.replace(/_/g, " ")})`;
    }
    if (req.requiredMasterGuide === true && !member.masterGuide) {
      return "Master Guide required";
    }
    if (req.requiredHonorCode && !member.completedHonorCodes.includes(req.requiredHonorCode.toUpperCase())) {
      return `Missing prerequisite honor (${req.requiredHonorCode})`;
    }
  }
  return null;
}

export default async function TeacherDashboardPage() {
  const session = await auth();

  if (!session?.user || session.user.role !== "STAFF_TEACHER") {
    redirect("/login");
  }

  const offerings = await prisma.eventClassOffering.findMany({
    where: {
      teacherUserId: session.user.id,
      event: {
        endsAt: {
          gte: new Date(),
        },
      },
    },
    select: {
      id: true,
      capacity: true,
      locationName: true,
      classCatalog: {
        select: {
          title: true,
          code: true,
          requirements: {
            select: { requirementType: true, config: true },
          },
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
      timeslot: {
        select: {
          label: true,
          startsAt: true,
          endsAt: true,
        },
      },
      enrollments: {
        select: {
          attendedAt: true,
          rosterMemberId: true,
          rosterMember: {
            select: {
              firstName: true,
              lastName: true,
              ageAtStart: true,
              memberRole: true,
              masterGuide: true,
              completedRequirements: {
                where: { requirementType: "COMPLETED_HONOR" },
                select: { metadata: true },
              },
              clubRosterYear: {
                select: {
                  club: { select: { name: true, code: true } },
                },
              },
            },
          },
        },
        orderBy: [
          { rosterMember: { lastName: "asc" } },
          { rosterMember: { firstName: "asc" } },
        ],
      },
    },
    orderBy: [
      { event: { startsAt: "asc" } },
      { timeslot: { sortOrder: "asc" } },
      { classCatalog: { title: "asc" } },
    ],
  });

  return (
    <section className="space-y-6">
      <header className="glass-panel">
        <p className="hero-kicker">Teacher Portal</p>
        <h1 className="hero-title mt-3">My Event Class Assignments</h1>
        <p className="hero-copy">
          Manage attendance and sign-off requirements for the event classes assigned to you.
        </p>
      </header>

      {offerings.length === 0 ? (
        <article className="empty-state text-sm text-slate-600">
          You do not have any upcoming event class assignments right now.
        </article>
      ) : (
        <div className="grid gap-6">
          {offerings.map((offering) => {
            const enrolledCount = offering.enrollments.length;
            const attendedCount = offering.enrollments.filter(
              (enrollment) => enrollment.attendedAt !== null,
            ).length;

            const requirements = offering.classCatalog.requirements.map((r) =>
              parseRequirementConfig(r.config),
            );

            return (
              <article key={offering.id} className="glass-card space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-indigo-600">{offering.event.name}</p>
                    <h2 className="mt-1 text-xl font-semibold text-slate-900">
                      {offering.classCatalog.title}
                      <span className="ml-2 text-sm font-medium text-slate-500">
                        ({offering.classCatalog.code})
                      </span>
                    </h2>
                    <p className="mt-1 text-sm font-medium text-slate-700">Event dates</p>
                    <p className="text-sm text-slate-600">
                      {formatDateRange(offering.event.startsAt, offering.event.endsAt)}
                    </p>
                    <p className="text-sm text-slate-500">
                      {offering.timeslot
                        ? `${offering.timeslot.label} • ${formatDateRange(offering.timeslot.startsAt, offering.timeslot.endsAt)}`
                        : "Timeslot TBD"}
                    </p>
                    <p className="text-sm text-slate-500">
                      {offering.locationName ?? offering.event.locationName ?? "Location TBD"}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <p className="text-sm font-semibold text-slate-700">
                      {enrolledCount}/{offering.capacity ?? "Open"} enrolled
                    </p>
                    <p className="text-xs text-slate-500">
                      Attendance marked: {attendedCount}/{enrolledCount}
                    </p>
                    <div className="flex gap-2">
                      <a
                        href={`/api/teacher/class/${offering.id}/roster-csv`}
                        download
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700"
                      >
                        Download Roster CSV
                      </a>
                      <Link href={`/teacher/class/${offering.id}`} className="btn-primary">
                        Open Roster
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Student list */}
                {offering.enrollments.length > 0 ? (
                  <div className="border-t border-slate-100 pt-4">
                    <h3 className="mb-2 text-sm font-semibold text-slate-700">
                      Enrolled Students
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-100 text-sm">
                        <thead className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <tr>
                            <th scope="col" className="pb-2 pr-4">Name</th>
                            <th scope="col" className="pb-2 pr-4">Club</th>
                            <th scope="col" className="pb-2 pr-4">Age</th>
                            <th scope="col" className="pb-2 pr-4">Role</th>
                            <th scope="col" className="pb-2">Prerequisite Flags</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {offering.enrollments.map((enrollment) => {
                            const m = enrollment.rosterMember;
                            const completedHonorCodes = m.completedRequirements
                              .map((r) => {
                                const meta = r.metadata as Record<string, unknown> | null;
                                const code = meta?.honorCode;
                                return typeof code === "string" ? code.toUpperCase() : null;
                              })
                              .filter((c): c is string => c !== null);
                            const flag = hasPrerequisiteWarning(
                              {
                                ageAtStart: m.ageAtStart,
                                memberRole: m.memberRole,
                                masterGuide: m.masterGuide,
                                completedHonorCodes,
                              },
                              requirements,
                            );
                            return (
                              <tr key={enrollment.rosterMemberId} className="align-top">
                                <td className="py-2 pr-4 font-medium text-slate-900">
                                  {m.lastName}, {m.firstName}
                                </td>
                                <td className="py-2 pr-4 text-slate-600">
                                  {m.clubRosterYear.club.name}
                                  <span className="ml-1 text-xs text-slate-400">
                                    ({m.clubRosterYear.club.code})
                                  </span>
                                </td>
                                <td className="py-2 pr-4 text-slate-600">
                                  {m.ageAtStart ?? "—"}
                                </td>
                                <td className="py-2 pr-4 text-slate-600">
                                  {m.memberRole.replace(/_/g, " ")}
                                </td>
                                <td className="py-2">
                                  {flag ? (
                                    <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                                      {flag}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-slate-400">None</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p className="border-t border-slate-100 pt-4 text-sm text-slate-500">
                    No students enrolled yet.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
