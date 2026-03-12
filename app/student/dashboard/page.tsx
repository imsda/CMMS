import { redirect } from "next/navigation";

import { auth } from "../../../auth";
import { getStudentPortalData } from "../../../lib/data/student-portal";

function formatDateTimeRange(startsAt: Date, endsAt: Date) {
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

export default async function StudentDashboardPage() {
  const session = await auth();

  if (!session?.user || session.user.role !== "STUDENT_PARENT") {
    redirect("/login");
  }

  const portalData = await getStudentPortalData(session.user.id);

  return (
    <section className="space-y-6">
      <header className="glass-panel">
        <p className="hero-kicker">Student/Parent Portal</p>
        <h1 className="hero-title mt-3">Dashboard</h1>
        <p className="hero-copy">
          Track completed honors and view upcoming event class assignments for linked student profiles.
        </p>
      </header>

      <article className="glass-panel">
        <h2 className="section-title">Linked Student Profiles</h2>

        {portalData.linkedStudents.length === 0 ? (
          <p className="empty-state mt-4 text-sm text-slate-600">
            No student profiles are linked to this account yet. Ask a super admin to assign your student links.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {portalData.linkedStudents.map((student) => (
              <div
                key={student.rosterMemberId}
                className="glass-card-soft"
              >
                <h3 className="text-lg font-semibold text-slate-900">{student.rosterMemberName}</h3>
                <p className="mt-1 text-sm text-slate-600">Role: {student.memberRole}</p>
                <p className="text-sm text-slate-600">
                  Club: {student.clubName} ({student.clubCode})
                </p>
                <p className="text-sm text-slate-500">Roster year: {student.rosterYearLabel}</p>
              </div>
            ))}
          </div>
        )}
      </article>

      <article className="glass-panel">
        <h2 className="section-title">My Completed Honors</h2>

        {portalData.completedHonors.length === 0 ? (
          <p className="empty-state mt-4 text-sm text-slate-600">
            No completed honors were found for your linked student profiles yet.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {portalData.completedHonors.map((honor) => (
              <div
                key={honor.id}
                className="glass-card-soft"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                  {honor.honorCode}
                </p>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">{honor.honorTitle}</h3>
                <p className="mt-2 text-sm text-slate-600">Student: {honor.rosterMemberName}</p>
                <p className="text-sm text-slate-500">
                  Completed on {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(honor.completedAt)}
                </p>
              </div>
            ))}
          </div>
        )}
      </article>

      <article className="glass-panel">
        <h2 className="section-title">Upcoming Event Class Assignments</h2>

        {portalData.eventClassAssignments.length === 0 ? (
          <p className="empty-state mt-4 text-sm text-slate-600">
            No linked students are currently enrolled in upcoming event classes.
          </p>
        ) : (
          <ol className="mt-4 space-y-4 border-l-2 border-slate-200 pl-4">
            {portalData.eventClassAssignments.map((entry) => (
              <li key={entry.enrollmentId} className="relative">
                <span className="absolute -left-[1.45rem] top-1.5 h-3 w-3 rounded-full bg-indigo-600" />
                <div className="glass-card-soft">
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                    {entry.eventName}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-900">{entry.classTitle}</h3>
                  <p className="mt-1 text-sm font-medium text-slate-700">Event dates</p>
                  <p className="text-sm text-slate-600">
                    {formatDateTimeRange(entry.eventStartsAt, entry.eventEndsAt)}
                  </p>
                  <p className="text-sm text-slate-600">Location: {entry.location ?? "TBD"}</p>
                  <p className="text-sm text-slate-500">Student: {entry.rosterMemberName}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </article>
    </section>
  );
}
