import { MonthlyReportStatus } from "@prisma/client";
import { getLocale } from "next-intl/server";

import { getAdminMonthlyReportDetail, reviewMonthlyReport } from "../../../../actions/club-report-actions";
import { buildCsvHref, slugifyFilenamePart } from "../../../../../lib/csv";
import { formatMonthlyReportStatus } from "../../../../../lib/monthly-report";
import { AdminPageHeader } from "../../../_components/admin-page-header";

function formatMonth(value: Date, locale: string) {
  return value.toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
}

function getStatusTone(status: MonthlyReportStatus) {
  switch (status) {
    case MonthlyReportStatus.APPROVED:
      return "status-chip-success";
    case MonthlyReportStatus.REVISION_REQUESTED:
      return "status-chip-danger";
    case MonthlyReportStatus.UNDER_REVIEW:
      return "status-chip-warning";
    case MonthlyReportStatus.SUBMITTED:
      return "status-chip-neutral";
    case MonthlyReportStatus.DRAFT:
    default:
      return "status-chip-neutral";
  }
}

export default async function AdminMonthlyReportDetailPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const locale = await getLocale();
  const { reportId } = await params;
  const report = await getAdminMonthlyReportDetail(reportId);
  const detailBase = `${slugifyFilenamePart(report.club.name)}-${report.reportMonth.toISOString().slice(0, 7)}`;
  const scoreBreakdownCsvHref = buildCsvHref([
    ["Line Item", "Points", "Max Points", "Notes"],
    ...report.scoreLineItems.map((item) => [item.label, item.points, item.maxPoints, item.notes ?? ""]),
  ]);

  return (
    <section className="space-y-8">
      <AdminPageHeader
        eyebrow="Monthly Report Review"
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Reports", href: "/admin/reports" },
          { label: report.club.name },
        ]}
        title={`${report.club.name} • ${formatMonth(report.reportMonth, locale)}`}
        description="Review the structured monthly report, score line items, and club submission notes before approving or requesting revisions."
        secondaryActions={
          <a href={scoreBreakdownCsvHref} download={`${detailBase}-score-breakdown.csv`} className="btn-secondary">
            Download Score Breakdown
          </a>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <article className="metric-card">
          <p className="metric-label">Status</p>
          <div className="mt-3">
            <span className={getStatusTone(report.status)}>{formatMonthlyReportStatus(report.status)}</span>
          </div>
          <p className="metric-caption">Current review workflow state.</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Total score</p>
          <p className="metric-value">{report.totalScore}</p>
          <p className="metric-caption">Computed from structured line items.</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Submitted by</p>
          <p className="metric-value text-2xl">{report.submittedByName ?? "Unknown"}</p>
          <p className="metric-caption">{report.submittedAt ? report.submittedAt.toLocaleDateString(locale) : "Not submitted"}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Roster year</p>
          <p className="metric-value text-2xl">{report.clubRosterYear?.yearLabel ?? "Not linked"}</p>
          <p className="metric-caption">Roster-year context for this report month.</p>
        </article>
      </div>

      <section className="workflow-studio">
        <div className="workflow-header">
          <div>
            <p className="hero-kicker">Report Narrative</p>
            <h2 className="section-title">Monthly report story and operating context</h2>
            <p className="section-copy">
              Review the club&apos;s schedule, attendance, ministry activity, and compliance notes before finalizing the score decision.
            </p>
          </div>
          <div className="workflow-actions">
            <a href={scoreBreakdownCsvHref} download={`${detailBase}-score-breakdown.csv`} className="btn-secondary">
              Export Score CSV
            </a>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <article className="workflow-card-muted">
            <div className="workflow-header">
              <div>
                <h3 className="section-title">Monthly report details</h3>
                <p className="section-copy">Use this as the primary reference when validating what the club actually reported this month.</p>
              </div>
              {report.revisionRequestedReason ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                  <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Open revision reason</p>
                  <p className="mt-1">{report.revisionRequestedReason}</p>
                </div>
              ) : null}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Meeting schedule</p>
              <p className="mt-2 text-sm text-slate-900">{report.meetingDay ?? "-"} {report.meetingTime ? `• ${report.meetingTime}` : ""}</p>
              <p className="mt-1 text-sm text-slate-600">{report.meetingLocation ?? "No location provided"}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Attendance snapshot</p>
              <p className="mt-2 text-sm text-slate-900">Average attendance: {report.averageAttendance}</p>
              <p className="mt-1 text-sm text-slate-600">
                Pathfinders {report.pathfinderCount} • TLTs {report.tltCount} • Staff {report.staffCount}
              </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 md:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Activity tracking</p>
              <p className="mt-2 text-sm text-slate-900">
                Staff meeting: {report.staffMeetingHeld ? "Yes" : "No"} • Meetings / outings: {report.meetingOutingCount} • Guest helpers: {report.guestHelperCount}
              </p>
              <p className="mt-2 text-sm text-slate-600"><span className="font-medium text-slate-800">Devotions:</span> {report.devotionsEmphasis ?? "No notes provided"}</p>
              <p className="mt-2 text-sm text-slate-600"><span className="font-medium text-slate-800">Exercise:</span> {report.exercisePromotion ?? "No notes provided"}</p>
              <p className="mt-2 text-sm text-slate-600"><span className="font-medium text-slate-800">Outreach:</span> {report.outreachActivities ?? "No notes provided"}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Uniform and compliance</p>
              <p className="mt-2 text-sm text-slate-900">{report.uniformCompliance}% compliance</p>
              <p className="mt-1 text-sm text-slate-600">{report.uniformNotes ?? "No uniform notes provided"}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Honor work</p>
              <p className="mt-2 text-sm text-slate-900">{report.honorParticipantCount} participants</p>
              <p className="mt-1 text-sm text-slate-600">{report.honorWorkSummary ?? "No honor summary provided"}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 md:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bonus items</p>
              <p className="mt-2 text-sm text-slate-600">{report.bonusNotes ?? "No bonus items provided."}</p>
              </div>
            </div>
          </article>

          <div className="space-y-5">
            <article className="workflow-card-muted">
              <div className="workflow-header">
                <div>
                  <h3 className="section-title">Score breakdown</h3>
                  <p className="section-copy">Review how the computed total is built before making a final decision.</p>
                </div>
                <span className="status-chip-neutral">{report.scoreLineItems.length} line items</span>
              </div>

              <div className="mt-4 space-y-3">
                {report.scoreLineItems.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
                    <div>
                      <p className="font-medium text-slate-900">{item.label}</p>
                      {item.notes ? <p className="mt-1 text-xs text-slate-500">{item.notes}</p> : null}
                    </div>
                    <span className="text-slate-700">{item.points}/{item.maxPoints}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="workflow-card-muted">
              <div className="workflow-header">
                <div>
                  <h3 className="section-title">Review decision</h3>
                  <p className="section-copy">Keep the decision trail clear for directors by updating notes and revision reasons here.</p>
                </div>
                <span className={getStatusTone(report.status)}>{formatMonthlyReportStatus(report.status)}</span>
              </div>

              <form action={reviewMonthlyReport} className="mt-5 space-y-4">
                <input type="hidden" name="reportId" value={report.id} />
                <label className="space-y-1 text-sm font-medium text-slate-700">
                  <span>Reviewer notes</span>
                  <textarea
                    name="reviewerNotes"
                    rows={4}
                    defaultValue={report.adminComments ?? ""}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm"
                  />
                </label>
                <label className="space-y-1 text-sm font-medium text-slate-700">
                  <span>Revision reason</span>
                  <textarea
                    name="revisionRequestedReason"
                    rows={3}
                    defaultValue={report.revisionRequestedReason ?? ""}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm"
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-3">
                  <button type="submit" name="status" value={MonthlyReportStatus.UNDER_REVIEW} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-slate-900">
                    Mark under review
                  </button>
                  <button type="submit" name="status" value={MonthlyReportStatus.REVISION_REQUESTED} className="rounded-xl border border-amber-200 px-4 py-2 text-sm font-semibold text-amber-700 shadow-sm transition hover:border-amber-300 hover:text-amber-800">
                    Request revision
                  </button>
                  <button type="submit" name="status" value={MonthlyReportStatus.APPROVED} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500">
                    Approve report
                  </button>
                </div>
              </form>
            </article>
          </div>
        </div>
      </section>
    </section>
  );
}
