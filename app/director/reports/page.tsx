import {
  deleteClubActivity,
  getDirectorReportsDashboardData,
  saveClubActivity,
  saveMonthlyReportDraft,
  submitMonthlyReport,
} from "../../actions/club-report-actions";
import { getLocale } from "next-intl/server";
import { formatDateInputValue } from "../../../lib/club-activity";
import { formatMonthlyReportStatus } from "../../../lib/monthly-report";
import { getManagedClubContext } from "../../../lib/club-management";

function formatMonthLabel(reportMonth: Date, locale: string) {
  return reportMonth.toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
}

function formatActivityDateLabel(activityDate: Date, locale: string) {
  return activityDate.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortMonth(reportMonth: Date, locale: string) {
  return reportMonth.toLocaleDateString(locale, {
    month: "short",
    year: "numeric",
  });
}

export default async function DirectorReportsPage({
  searchParams,
}: {
  searchParams?: Promise<{ clubId?: string; month?: string }>;
}) {
  const locale = await getLocale();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const managedClub = await getManagedClubContext(resolvedSearchParams?.clubId ?? null);
  const dashboardData = await getDirectorReportsDashboardData(managedClub.clubId, resolvedSearchParams?.month ?? null);
  const currentReport = dashboardData.selectedMonthExistingReport;
  const scoreItems = currentReport?.scoreLineItems ?? dashboardData.selectedMonthScorePreview;

  return (
    <section className="space-y-8">
      <header className="glass-panel">
        <p className="hero-kicker">Monthly Report Module</p>
        <h1 className="hero-title mt-3">{dashboardData.clubName}</h1>
        <p className="hero-copy">
          Build, score, and submit the Pathfinder monthly report for {formatMonthLabel(dashboardData.selectedMonth, locale)}.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-5">
        <article className="metric-card">
          <p className="metric-label">Activity logs</p>
          <p className="metric-value">{dashboardData.selectedMonthAutoFill.activityCount}</p>
          <p className="metric-caption">Logs feeding this month&apos;s auto-fill.</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Roster year</p>
          <p className="metric-value text-2xl">{dashboardData.selectedRosterYear?.yearLabel ?? "Missing"}</p>
          <p className="metric-caption">Month-to-roster-year linkage for report context.</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Status</p>
          <p className="metric-value text-2xl">{currentReport ? formatMonthlyReportStatus(currentReport.status) : "Draft"}</p>
          <p className="metric-caption">Current workflow state for this report month.</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Computed score</p>
          <p className="metric-value">{currentReport?.totalScore ?? dashboardData.selectedMonthTotalScore}</p>
          <p className="metric-caption">Automatic total from the structured score line items.</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Club identity</p>
          <p className="metric-value text-2xl">{dashboardData.clubCode || "Club"}</p>
          <p className="metric-caption">{dashboardData.clubName}</p>
        </article>
      </div>

      <form className="space-y-8">
        {managedClub.isSuperAdmin ? <input type="hidden" name="clubId" value={managedClub.clubId} /> : null}
        <input type="hidden" name="reportMonth" value={dashboardData.selectedMonthInput} />

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Club Information</h2>
              <p className="mt-1 text-sm text-slate-600">
                Confirm the club snapshot and meeting schedule for the selected month.
              </p>
            </div>
            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span>Reporting month</span>
              <input
                type="month"
                name="reportMonthDisplay"
                readOnly
                value={dashboardData.selectedMonthInput}
                className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700 shadow-sm"
              />
            </label>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span>Club name</span>
              <input
                type="text"
                readOnly
                value={dashboardData.clubName}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700 shadow-sm"
              />
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span>Club code</span>
              <input
                type="text"
                readOnly
                value={dashboardData.clubCode}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700 shadow-sm"
              />
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span>Meeting day</span>
              <input
                type="text"
                name="meetingDay"
                defaultValue={dashboardData.selectedMonthFormValues.meetingDay}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm"
              />
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span>Meeting time</span>
              <input
                type="text"
                name="meetingTime"
                defaultValue={dashboardData.selectedMonthFormValues.meetingTime}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm"
              />
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2 xl:col-span-4">
              <span>Meeting location</span>
              <input
                type="text"
                name="meetingLocation"
                defaultValue={dashboardData.selectedMonthFormValues.meetingLocation}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm"
              />
            </label>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Attendance and Membership</h2>
          <p className="mt-1 text-sm text-slate-600">
            Capture attendance averages and the current Pathfinder, TLT, and staff counts for the month.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span>Average attendance</span>
              <input type="number" min={0} name="averageAttendance" required defaultValue={dashboardData.selectedMonthFormValues.averageAttendance} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm" />
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span>Average Pathfinder attendance</span>
              <input type="number" min={0} name="averagePathfinderAttendance" required defaultValue={dashboardData.selectedMonthFormValues.averagePathfinderAttendance} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm" />
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span>Average TLT attendance</span>
              <input type="number" min={0} name="averageTltAttendance" defaultValue={dashboardData.selectedMonthFormValues.averageTltAttendance} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm" />
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span>Average staff attendance</span>
              <input type="number" min={0} name="averageStaffAttendance" required defaultValue={dashboardData.selectedMonthFormValues.averageStaffAttendance} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm" />
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span>Pathfinder count</span>
              <input type="number" min={0} name="pathfinderCount" required defaultValue={dashboardData.selectedMonthFormValues.pathfinderCount} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm" />
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span>TLT count</span>
              <input type="number" min={0} name="tltCount" defaultValue={dashboardData.selectedMonthFormValues.tltCount} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm" />
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span>Staff count</span>
              <input type="number" min={0} name="staffCount" required defaultValue={dashboardData.selectedMonthFormValues.staffCount} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm" />
            </label>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Program Activity Tracking</h2>
          <p className="mt-1 text-sm text-slate-600">
            Record core club life for the month, including staff meetings, outings, devotions, exercise, and outreach.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
              <input type="checkbox" name="staffMeetingHeld" defaultChecked={dashboardData.selectedMonthFormValues.staffMeetingHeld} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
              Staff meeting held this month
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span>Meetings and outings count</span>
              <input type="number" min={0} name="meetingOutingCount" required defaultValue={dashboardData.selectedMonthFormValues.meetingOutingCount} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm" />
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2">
              <span>Devotions emphasis</span>
              <textarea name="devotionsEmphasis" rows={3} defaultValue={dashboardData.selectedMonthFormValues.devotionsEmphasis} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm" />
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2">
              <span>Exercise promotion</span>
              <textarea name="exercisePromotion" rows={3} defaultValue={dashboardData.selectedMonthFormValues.exercisePromotion} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm" />
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2">
              <span>Outreach and ministry activities</span>
              <textarea name="outreachActivities" rows={3} defaultValue={dashboardData.selectedMonthFormValues.outreachActivities} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm" />
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span>Guest helpers count</span>
              <input type="number" min={0} name="guestHelperCount" defaultValue={dashboardData.selectedMonthFormValues.guestHelperCount} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm" />
            </label>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Compliance and Honor Work</h2>
          <p className="mt-1 text-sm text-slate-600">
            Track uniform compliance, honor progress, and any bonus items that should be visible to conference review.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span>Uniform compliance (%)</span>
              <input type="number" min={0} max={100} name="uniformCompliance" required defaultValue={dashboardData.selectedMonthFormValues.uniformCompliance} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm" />
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span>Honor participant count</span>
              <input type="number" min={0} name="honorParticipantCount" defaultValue={dashboardData.selectedMonthFormValues.honorParticipantCount} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm" />
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2">
              <span>Uniform and compliance notes</span>
              <textarea name="uniformNotes" rows={3} defaultValue={dashboardData.selectedMonthFormValues.uniformNotes} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm" />
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2">
              <span>Honor work summary</span>
              <textarea name="honorWorkSummary" rows={3} defaultValue={dashboardData.selectedMonthFormValues.honorWorkSummary} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm" />
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2">
              <span>Bonus item notes</span>
              <textarea name="bonusNotes" rows={3} defaultValue={dashboardData.selectedMonthFormValues.bonusNotes} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm" />
            </label>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Final Review and Signature</h2>
          <p className="mt-1 text-sm text-slate-600">
            Review the computed line items below, then save a draft or submit the report for conference review.
          </p>
          <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <label className="space-y-1 text-sm font-medium text-slate-700">
                <span>Submitted by</span>
                <input type="text" name="submittedByName" required defaultValue={dashboardData.selectedMonthFormValues.submittedByName} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm" />
              </label>
              {currentReport?.revisionRequestedReason ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
                  <p className="font-semibold">Revision requested</p>
                  <p className="mt-2">{currentReport.revisionRequestedReason}</p>
                </div>
              ) : null}
              {currentReport?.adminComments ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-semibold">Reviewer notes</p>
                  <p className="mt-2">{currentReport.adminComments}</p>
                </div>
              ) : null}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Score breakdown</h3>
                <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                  Total {currentReport?.totalScore ?? dashboardData.selectedMonthTotalScore}
                </span>
              </div>
              <ol className="mt-4 space-y-3">
                {scoreItems.map((item) => (
                  <li key={item.key} className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">
                    <div>
                      <p className="font-medium text-slate-900">{item.label}</p>
                      {item.notes ? <p className="mt-1 text-xs text-slate-500">{item.notes}</p> : null}
                    </div>
                    <span className="text-slate-700">
                      {item.points}/{item.maxPoints}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              formAction={saveMonthlyReportDraft}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-slate-900"
            >
              Save draft
            </button>
            <button
              formAction={submitMonthlyReport}
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
            >
              Submit monthly report
            </button>
          </div>
        </article>
      </form>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Reporting history</h2>
              <p className="mt-1 text-sm text-slate-600">Track status and scoring across recent months.</p>
            </div>
          </div>
          {dashboardData.recentReports.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">No monthly reports have been started yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <tr>
                    <th scope="col" className="px-4 py-3">Month</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                    <th scope="col" className="px-4 py-3">Score</th>
                    <th scope="col" className="px-4 py-3">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dashboardData.recentReports.map((report) => (
                    <tr key={report.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">{formatShortMonth(report.reportMonth, locale)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatMonthlyReportStatus(report.status)}</td>
                      <td className="px-4 py-3 text-slate-700">{report.totalScore}</td>
                      <td className="px-4 py-3 text-slate-700">{report.submittedAt ? report.submittedAt.toLocaleDateString(locale) : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Activity log support</h2>
              <p className="mt-1 text-sm text-slate-600">
                Activity logs still feed attendance and uniform auto-fill for this month.
              </p>
            </div>
            <p className="text-sm text-slate-500">{dashboardData.selectedMonthActivities.length} entries</p>
          </div>

          <form action={saveClubActivity} className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
            {managedClub.isSuperAdmin ? <input type="hidden" name="clubId" value={managedClub.clubId} /> : null}
            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span>Activity date</span>
              <input type="date" name="activityDate" required defaultValue={`${dashboardData.selectedMonthInput}-01`} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm" />
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span>Title</span>
              <input type="text" name="title" required className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm" />
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span>Pathfinder attendance</span>
              <input type="number" name="pathfinderAttendance" min={0} required className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm" />
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span>Staff attendance</span>
              <input type="number" name="staffAttendance" min={0} required className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm" />
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span>Uniform compliance</span>
              <input type="number" name="uniformCompliance" min={0} max={100} required className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm" />
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2">
              <span>Notes</span>
              <textarea name="notes" rows={3} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm" />
            </label>
            <div className="md:col-span-2">
              <button type="submit" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-slate-900">
                Add activity
              </button>
            </div>
          </form>

          <div className="mt-6 space-y-3">
            {dashboardData.selectedMonthActivities.length === 0 ? (
              <p className="text-sm text-slate-600">No activity logs recorded yet for this month.</p>
            ) : (
              dashboardData.selectedMonthActivities.map((activity) => (
                <div key={activity.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{activity.title}</p>
                    <p className="text-sm text-slate-600">
                      {formatActivityDateLabel(activity.activityDate, locale)} • {activity.pathfinderAttendance} Pathfinders • {activity.staffAttendance} staff • {activity.uniformCompliance}% uniform
                    </p>
                    {activity.notes ? <p className="mt-1 text-sm text-slate-500">{activity.notes}</p> : null}
                  </div>
                  <form action={deleteClubActivity}>
                    {managedClub.isSuperAdmin ? <input type="hidden" name="clubId" value={managedClub.clubId} /> : null}
                    <input type="hidden" name="activityId" value={activity.id} />
                    <button type="submit" className="rounded-xl border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 shadow-sm transition hover:border-rose-300 hover:text-rose-800">
                      Remove
                    </button>
                  </form>
                </div>
              ))
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
