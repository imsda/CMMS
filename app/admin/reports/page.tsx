import Link from "next/link";

import { getAdminReportsData } from "../../actions/club-report-actions";

type ReportsPageProps = {
  searchParams?: Promise<{
    sort?: string;
    direction?: string;
  }>;
};

function formatMonth(reportMonth: Date) {
  return reportMonth.toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

function parseSort(value: string | undefined) {
  return value === "club" ? "club" : "month";
}

function parseDirection(value: string | undefined) {
  return value === "asc" ? "asc" : "desc";
}

function getDirectionToggle(currentDirection: "asc" | "desc") {
  return currentDirection === "asc" ? "desc" : "asc";
}

export default async function AdminReportsPage({ searchParams }: ReportsPageProps) {
  const resolvedSearchParams = await searchParams;
  const sortBy = parseSort(resolvedSearchParams?.sort);
  const direction = parseDirection(resolvedSearchParams?.direction);
  const nextDirection = getDirectionToggle(direction);

  const reportData = await getAdminReportsData(sortBy, direction);

  return (
    <section className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">Conference Reporting</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Submitted Reports Review</h1>
          <p className="mt-1 text-sm text-slate-600">
            Review all submitted monthly and year-end reports from clubs across the Conference.
          </p>
        </div>
        <div className="flex gap-2 text-xs font-semibold">
          <Link
            href={`/admin/reports?sort=club&direction=${sortBy === "club" ? nextDirection : "asc"}`}
            className="rounded-lg border border-slate-300 px-3 py-2 text-slate-700 hover:border-indigo-300 hover:text-indigo-700"
          >
            Sort by Club
          </Link>
          <Link
            href={`/admin/reports?sort=month&direction=${sortBy === "month" ? nextDirection : "desc"}`}
            className="rounded-lg border border-slate-300 px-3 py-2 text-slate-700 hover:border-indigo-300 hover:text-indigo-700"
          >
            Sort by Month
          </Link>
        </div>
      </header>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Monthly Reports</h2>
        {reportData.monthlyReports.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No submitted monthly reports found.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3">Club</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Report Month</th>
                  <th className="px-4 py-3">Meetings</th>
                  <th className="px-4 py-3">Uniform %</th>
                  <th className="px-4 py-3">Points</th>
                  <th className="px-4 py-3">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData.monthlyReports.map((report) => (
                  <tr key={report.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{report.club.name}</td>
                    <td className="px-4 py-3 text-slate-700">{report.club.code}</td>
                    <td className="px-4 py-3 text-slate-700">{formatMonth(report.reportMonth)}</td>
                    <td className="px-4 py-3 text-slate-700">{report.meetingCount}</td>
                    <td className="px-4 py-3 text-slate-700">{report.uniformCompliance}%</td>
                    <td className="px-4 py-3 text-slate-700">{report.pointsCalculated}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {report.submittedAt ? report.submittedAt.toLocaleDateString() : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Year-End Reports</h2>
        {reportData.yearEndReports.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No submitted year-end reports found.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3">Club</th>
                  <th className="px-4 py-3">Year</th>
                  <th className="px-4 py-3">Friend</th>
                  <th className="px-4 py-3">Companion</th>
                  <th className="px-4 py-3">Explorer</th>
                  <th className="px-4 py-3">Ranger</th>
                  <th className="px-4 py-3">Voyager</th>
                  <th className="px-4 py-3">Guide</th>
                  <th className="px-4 py-3">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData.yearEndReports.map((report) => (
                  <tr key={report.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{report.club.name}</td>
                    <td className="px-4 py-3 text-slate-700">{report.reportYear}</td>
                    <td className="px-4 py-3 text-slate-700">{report.friendCompletions}</td>
                    <td className="px-4 py-3 text-slate-700">{report.companionCompletions}</td>
                    <td className="px-4 py-3 text-slate-700">{report.explorerCompletions}</td>
                    <td className="px-4 py-3 text-slate-700">{report.rangerCompletions}</td>
                    <td className="px-4 py-3 text-slate-700">{report.voyagerCompletions}</td>
                    <td className="px-4 py-3 text-slate-700">{report.guideCompletions}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {report.submittedAt ? report.submittedAt.toLocaleDateString() : "-"}
                    </td>
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
