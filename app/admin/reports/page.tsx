import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { getAdminReportsData } from "../../actions/club-report-actions";
import { buildCsvHref, slugifyFilenamePart } from "../../../lib/csv";
import { formatMonthlyReportStatus } from "../../../lib/monthly-report";
import { AdminPageHeader } from "../_components/admin-page-header";

type ReportsPageProps = {
  searchParams?: Promise<{
    sort?: string;
    direction?: string;
  }>;
};

function formatMonth(reportMonth: Date, locale: string) {
  return reportMonth.toLocaleDateString(locale, {
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
  const t = await getTranslations("Admin");
  const locale = await getLocale();
  const resolvedSearchParams = await searchParams;
  const sortBy = parseSort(resolvedSearchParams?.sort);
  const direction = parseDirection(resolvedSearchParams?.direction);
  const nextDirection = getDirectionToggle(direction);

  const reportData = await getAdminReportsData(sortBy, direction);
  const monthBase = slugifyFilenamePart(
    reportData.currentMonth.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    }),
  );
  const monthlySummaryCsvHref = buildCsvHref([
    ["Club", "Code", "Month", "Status", "Score", "Submitted By", "Submitted At", "Revision Reason"],
    ...reportData.monthlyReports.map((report) => [
      report.club.name,
      report.club.code,
      formatMonth(report.reportMonth, locale),
      formatMonthlyReportStatus(report.status),
      report.totalScore,
      report.submittedByName ?? "",
      report.submittedAt?.toISOString() ?? "",
      report.revisionRequestedReason ?? "",
    ]),
  ]);
  const scoreBreakdownCsvHref = buildCsvHref([
    ["Club", "Code", "Month", "Line Item", "Points", "Max Points", "Notes"],
    ...reportData.monthlyReports.flatMap((report) =>
      report.scoreLineItems.map((item) => [
        report.club.name,
        report.club.code,
        formatMonth(report.reportMonth, locale),
        item.label,
        item.points,
        item.maxPoints,
        item.notes ?? "",
      ]),
    ),
  ]);
  const missingReportsCsvHref = buildCsvHref([
    ["Club", "Code", "Type", "Gap", "Month"],
    ...reportData.missingCurrentMonthReports.map((club) => [
      club.name,
      club.code,
      club.type,
      club.status ? formatMonthlyReportStatus(club.status) : "Missing",
      formatMonth(reportData.currentMonth, locale),
    ]),
  ]);

  return (
    <section className="space-y-8">
      <AdminPageHeader
        eyebrow={t("pages.reports.eyebrow")}
        breadcrumbs={[{ label: t("breadcrumbs.admin"), href: "/admin/dashboard" }, { label: t("breadcrumbs.reports") }]}
        title={t("pages.reports.title")}
        description="Review structured monthly reports, move them through conference workflow states, and keep year-end reporting in view."
        secondaryActions={
          <>
            <Link
              href={`/admin/reports?sort=club&direction=${sortBy === "club" ? nextDirection : "asc"}`}
              className="btn-secondary"
            >
              {t("actions.sortByClub")}
            </Link>
            <Link
              href={`/admin/reports?sort=month&direction=${sortBy === "month" ? nextDirection : "desc"}`}
              className="btn-secondary"
            >
              {t("actions.sortByMonth")}
            </Link>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <article className="metric-card">
          <p className="metric-label">Submitted</p>
          <p className="metric-value">{reportData.monthlySummary.submitted}</p>
          <p className="metric-caption">Reports waiting for admin review.</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Under review</p>
          <p className="metric-value">{reportData.monthlySummary.underReview}</p>
          <p className="metric-caption">Reports actively being reviewed.</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Approved</p>
          <p className="metric-value">{reportData.monthlySummary.approved}</p>
          <p className="metric-caption">Conference-approved monthly reports.</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Revision requested</p>
          <p className="metric-value">{reportData.monthlySummary.revisionRequested}</p>
          <p className="metric-caption">Reports sent back to the club for updates.</p>
        </article>
      </div>

      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Monthly report exports</h2>
            <p className="mt-1 text-sm text-slate-600">Download the conference summary, line-item score breakdown, or the current month’s missing-report list.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={monthlySummaryCsvHref} download={`monthly-reports-${monthBase}.csv`} className="btn-secondary">Summary CSV</a>
            <a href={scoreBreakdownCsvHref} download={`monthly-report-scores-${monthBase}.csv`} className="btn-secondary">Score Breakdown CSV</a>
            <a href={missingReportsCsvHref} download={`missing-monthly-reports-${monthBase}.csv`} className="btn-secondary">Missing Reports CSV</a>
          </div>
        </div>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Overdue / Missing for {formatMonth(reportData.currentMonth, locale)}</h2>
        {reportData.missingCurrentMonthReports.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">All clubs currently have a monthly report on file for this month.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-3">Club</th>
                  <th scope="col" className="px-4 py-3">Code</th>
                  <th scope="col" className="px-4 py-3">Type</th>
                  <th scope="col" className="px-4 py-3">Gap</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData.missingCurrentMonthReports.map((club) => (
                  <tr key={club.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{club.name}</td>
                    <td className="px-4 py-3 text-slate-700">{club.code}</td>
                    <td className="px-4 py-3 text-slate-700">{club.type}</td>
                    <td className="px-4 py-3 text-slate-700">{club.status ? formatMonthlyReportStatus(club.status) : "Missing"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Monthly report workflow</h2>
        {reportData.monthlyReports.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No monthly reports have been started yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-3">Club</th>
                  <th scope="col" className="px-4 py-3">Code</th>
                  <th scope="col" className="px-4 py-3">Report month</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Score</th>
                  <th scope="col" className="px-4 py-3">Submitted by</th>
                  <th scope="col" className="px-4 py-3">Updated</th>
                  <th scope="col" className="px-4 py-3">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData.monthlyReports.map((report) => (
                  <tr key={report.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{report.club.name}</td>
                    <td className="px-4 py-3 text-slate-700">{report.club.code}</td>
                    <td className="px-4 py-3 text-slate-700">{formatMonth(report.reportMonth, locale)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatMonthlyReportStatus(report.status)}</td>
                    <td className="px-4 py-3 text-slate-700">{report.totalScore}</td>
                    <td className="px-4 py-3 text-slate-700">{report.submittedByName ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-700">{report.updatedAt.toLocaleDateString(locale)}</td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/reports/monthly/${report.id}`} className="btn-secondary px-3 py-1.5 text-xs">
                        Open review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">{t("pages.reports.yearEndTitle")}</h2>
        {reportData.yearEndReports.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">{t("pages.reports.yearEndEmpty")}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-3">{t("pages.reports.columns.club")}</th>
                  <th scope="col" className="px-4 py-3">{t("pages.reports.columns.year")}</th>
                  <th scope="col" className="px-4 py-3">{t("pages.reports.columns.friend")}</th>
                  <th scope="col" className="px-4 py-3">{t("pages.reports.columns.companion")}</th>
                  <th scope="col" className="px-4 py-3">{t("pages.reports.columns.explorer")}</th>
                  <th scope="col" className="px-4 py-3">{t("pages.reports.columns.ranger")}</th>
                  <th scope="col" className="px-4 py-3">{t("pages.reports.columns.voyager")}</th>
                  <th scope="col" className="px-4 py-3">{t("pages.reports.columns.guide")}</th>
                  <th scope="col" className="px-4 py-3">{t("pages.reports.columns.submitted")}</th>
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
                      {report.submittedAt ? report.submittedAt.toLocaleDateString(locale) : "-"}
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
