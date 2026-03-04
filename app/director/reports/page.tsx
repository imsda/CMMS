import { createMonthlyReport, getDirectorReportsDashboardData } from "../../actions/club-report-actions";

function formatMonthLabel(reportMonth: Date) {
  return reportMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export default async function DirectorReportsPage() {
  const dashboardData = await getDirectorReportsDashboardData();

  return (
    <section className="space-y-8">
      <header>
        <p className="text-sm font-medium text-slate-500">Club Reporting</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          {dashboardData.clubName} Reporting Engine
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Replace paper submissions by sending your monthly metrics directly to the Conference.
        </p>
      </header>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Start Monthly Report</h2>
        <p className="mt-1 text-sm text-slate-600">
          Points are auto-calculated when you submit: {dashboardData.rubric.pointsPerMeeting} points per
          meeting, {dashboardData.rubric.pointsPerPathfinderAttendance} per Pathfinder average attendance,
          {dashboardData.rubric.pointsPerStaffAttendance} per staff average attendance, plus uniform
          compliance bonus up to {dashboardData.rubric.maxUniformPoints}.
        </p>

        <form action={createMonthlyReport} className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm font-medium text-slate-700">
            <span>Report month</span>
            <input
              type="month"
              name="reportMonth"
              required
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>

          <label className="space-y-1 text-sm font-medium text-slate-700">
            <span>Number of meetings</span>
            <input
              type="number"
              name="meetingCount"
              min={0}
              required
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>

          <label className="space-y-1 text-sm font-medium text-slate-700">
            <span>Average Pathfinder attendance</span>
            <input
              type="number"
              name="averagePathfinderAttendance"
              min={0}
              required
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>

          <label className="space-y-1 text-sm font-medium text-slate-700">
            <span>Average staff attendance</span>
            <input
              type="number"
              name="averageStaffAttendance"
              min={0}
              required
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>

          <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2">
            <span>Uniform compliance (%)</span>
            <input
              type="number"
              name="uniformCompliance"
              min={0}
              max={100}
              required
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>

          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
            >
              Submit Monthly Report
            </button>
          </div>
        </form>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Recent Monthly Submissions</h2>
        {dashboardData.recentReports.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No monthly reports have been submitted yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3">Month</th>
                  <th className="px-4 py-3">Meetings</th>
                  <th className="px-4 py-3">Uniform %</th>
                  <th className="px-4 py-3">Points</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dashboardData.recentReports.map((report) => (
                  <tr key={report.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{formatMonthLabel(report.reportMonth)}</td>
                    <td className="px-4 py-3 text-slate-700">{report.meetingCount}</td>
                    <td className="px-4 py-3 text-slate-700">{report.uniformCompliance}%</td>
                    <td className="px-4 py-3 text-slate-700">{report.pointsCalculated}</td>
                    <td className="px-4 py-3 text-slate-700">{report.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}
