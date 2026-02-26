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
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Student/Parent Portal</p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-2 text-sm text-slate-600">
          Track completed honors and view upcoming class sessions for linked student profiles.
        </p>
      </header>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">My Completed Honors</h2>

        {portalData.completedHonors.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">
            No completed honors were found for your linked student profile yet.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {portalData.completedHonors.map((honor) => (
              <div
                key={honor.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
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

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Upcoming Event Schedule</h2>

        {portalData.schedule.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">
            You are not currently enrolled in any upcoming event classes.
          </p>
        ) : (
          <ol className="mt-4 space-y-4 border-l-2 border-slate-200 pl-4">
            {portalData.schedule.map((entry) => (
              <li key={entry.enrollmentId} className="relative">
                <span className="absolute -left-[1.45rem] top-1.5 h-3 w-3 rounded-full bg-indigo-600" />
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                    {entry.eventName}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-900">{entry.classTitle}</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {formatDateTimeRange(entry.startsAt, entry.endsAt)}
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
