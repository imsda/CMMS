"use client";

import { useTranslations } from "next-intl";
import { useFormState, useFormStatus } from "react-dom";

import {
  initialComplianceSyncState,
  type ComplianceSyncState,
} from "../../../actions/compliance-state";
import {
  applySterlingBackgroundChecksPreview,
  previewSterlingBackgroundChecks,
} from "../../../actions/compliance-actions";
import { AdminPageHeader } from "../../_components/admin-page-header";

type RosterYearDashboardRow = {
  id: string;
  yearLabel: string;
  isActive: boolean;
  club: {
    name: string;
    code: string;
  };
  compliance: {
    adultCount: number;
    clearedAdultCount: number;
    unclearedAdultCount: number;
    clearanceRate: number;
    status: "ready" | "attention" | "empty";
    latestRunStatus: "PREVIEW" | "APPLIED" | "NONE";
    latestRunAt: Date | null;
    latestAppliedAt: Date | null;
    latestRunAmbiguousCount: number;
    latestRunUpdateCount: number;
  };
};

type RecentRunRow = {
  id: string;
  fileName: string;
  status: "PREVIEW" | "APPLIED";
  scope: "ROSTER_YEAR" | "SYSTEM_WIDE";
  updateCount: number;
  ambiguousCount: number;
  skippedCount: number;
  passedRows: number;
  processedRows: number;
  createdAt: Date;
  appliedAt: Date | null;
  scopeLabel: string;
};

type ComplianceSyncDashboardProps = {
  dashboardData: {
    overview: {
      totalRuns: number;
      previewRuns: number;
      appliedRuns: number;
      systemWideRuns: number;
      rosterYearRuns: number;
      pendingAmbiguousRows: number;
      safeUpdatesIdentified: number;
    };
    rosterYearStatuses: RosterYearDashboardRow[];
    recentRuns: RecentRunRow[];
  };
};

function statusTextClass(status: ComplianceSyncState["status"]) {
  if (status === "error") {
    return "text-rose-600";
  }

  if (status === "success") {
    return "text-emerald-700";
  }

  return "text-slate-600";
}

function formatDateTime(value: Date | null) {
  if (!value) {
    return "—";
  }

  return value.toLocaleString();
}

function complianceTone(status: RosterYearDashboardRow["compliance"]["status"]) {
  if (status === "ready") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (status === "attention") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function ComplianceSyncDashboard({ dashboardData }: ComplianceSyncDashboardProps) {
  const t = useTranslations("Admin");
  const [previewState, previewAction] = useFormState(
    previewSterlingBackgroundChecks,
    initialComplianceSyncState,
  );
  const [applyState, applyAction] = useFormState(
    applySterlingBackgroundChecksPreview,
    initialComplianceSyncState,
  );

  const state = applyState.phase !== "idle" ? applyState : previewState;

  return (
    <section className="space-y-8">
      <AdminPageHeader
        eyebrow={t("pages.compliance.eyebrow")}
        breadcrumbs={[
          { label: t("breadcrumbs.admin"), href: "/admin/dashboard" },
          { label: t("breadcrumbs.compliance"), href: "/admin/compliance" },
          { label: t("breadcrumbs.compliance") },
        ]}
        title={t("pages.compliance.title")}
        description={t("pages.compliance.description")}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Recent Sync Runs" value={dashboardData.overview.totalRuns} />
        <MetricCard label="Applied Runs" value={dashboardData.overview.appliedRuns} />
        <MetricCard label="Preview Runs" value={dashboardData.overview.previewRuns} />
        <MetricCard label="Pending Ambiguous Rows" value={dashboardData.overview.pendingAmbiguousRows} />
        <MetricCard label="Safe Updates Identified" value={dashboardData.overview.safeUpdatesIdentified} />
        <MetricCard label="Roster-Year Runs" value={dashboardData.overview.rosterYearRuns} />
        <MetricCard label="System-Wide Runs" value={dashboardData.overview.systemWideRuns} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="glass-panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="section-title">Roster-Year Readiness</h2>
              <p className="section-copy">Adult clearance status by active or historical roster year.</p>
            </div>
            <span className="status-chip-neutral">{dashboardData.rosterYearStatuses.length} roster year(s)</span>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-3">Scope</th>
                  <th scope="col" className="px-4 py-3">Adults Cleared</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Latest Sync</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dashboardData.rosterYearStatuses.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="px-4 py-3 text-slate-900">
                      <p className="font-semibold">{row.club.name}</p>
                      <p className="text-xs text-slate-500">
                        {row.club.code} • {row.yearLabel}
                        {row.isActive ? " • Active" : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <p className="font-semibold">
                        {row.compliance.clearedAdultCount} / {row.compliance.adultCount}
                      </p>
                      <p className="text-xs text-slate-500">{row.compliance.clearanceRate}% cleared</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${complianceTone(row.compliance.status)}`}>
                        {row.compliance.status === "ready"
                          ? "Ready"
                          : row.compliance.status === "attention"
                            ? `${row.compliance.unclearedAdultCount} missing`
                            : "No adults"}
                      </span>
                      <p className="mt-2 text-xs text-slate-500">
                        Ambiguous in latest run: {row.compliance.latestRunAmbiguousCount}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <p>{row.compliance.latestRunStatus}</p>
                      <p className="text-xs text-slate-500">{formatDateTime(row.compliance.latestRunAt)}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="glass-panel">
          <h2 className="section-title">Recent Sync History</h2>
          <p className="section-copy">Latest preview/apply runs, including scope and ambiguity counts.</p>

          {dashboardData.recentRuns.length === 0 ? (
            <p className="empty-state mt-4 text-sm text-slate-600">No compliance sync runs have been recorded yet.</p>
          ) : (
            <ol className="mt-4 space-y-3">
              {dashboardData.recentRuns.map((run) => (
                <li key={run.id} className="glass-card-soft">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{run.fileName}</p>
                      <p className="text-xs text-slate-500">{run.scopeLabel}</p>
                    </div>
                    <span className="status-chip-neutral">{run.status}</span>
                  </div>
                  <div className="mt-2 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                    <p>Processed: {run.processedRows}</p>
                    <p>Passed: {run.passedRows}</p>
                    <p>Safe updates: {run.updateCount}</p>
                    <p>Ambiguous: {run.ambiguousCount}</p>
                    <p>Created: {formatDateTime(run.createdAt)}</p>
                    <p>Applied: {formatDateTime(run.appliedAt)}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </article>
      </div>

      <form action={previewAction} className="glass-panel space-y-5">
        <label className="block space-y-1 text-sm text-slate-700">
          <span>Sync scope</span>
          <select
            name="clubRosterYearId"
            required
            defaultValue="SYSTEM_WIDE"
            className="select-glass"
          >
            <option value="SYSTEM_WIDE">Entire system (all clubs and roster years)</option>
            {dashboardData.rosterYearStatuses.map((rosterYear) => (
              <option key={rosterYear.id} value={rosterYear.id}>
                {rosterYear.club.name} ({rosterYear.club.code}) — {rosterYear.yearLabel}
                {rosterYear.isActive ? " • Active" : ""}
              </option>
            ))}
          </select>
        </label>

        <label
          htmlFor="sterlingCsv"
          className="glass-subsection flex cursor-pointer flex-col items-center justify-center gap-2 px-6 py-10 text-center"
        >
          <span className="text-sm font-semibold text-slate-700">Drop CSV here or click to browse</span>
          <span className="text-xs text-slate-500">
            Accepted columns: First Name, Last Name, Status, and optional DOB/Date of Birth.
          </span>
          <input
            id="sterlingCsv"
            name="sterlingCsv"
            type="file"
            accept=".csv,text/csv"
            required
            className="mt-2 block w-full max-w-xs rounded-2xl border border-slate-300 bg-white/80 px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-xl file:border-0 file:bg-indigo-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-indigo-500"
          />
        </label>

        <PreviewButton />
      </form>

      {state.phase !== "idle" ? (
        <article className="glass-panel">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Preview / Apply Result</h2>
              <p className={`mt-2 text-sm ${statusTextClass(state.status)}`}>{state.message}</p>
              {state.scopeLabel ? (
                <p className="mt-1 text-xs font-medium text-slate-500">
                  Scope: {state.scopeLabel}
                  {state.fileName ? ` • File: ${state.fileName}` : ""}
                </p>
              ) : null}
            </div>

            {state.phase === "preview" && state.runId ? (
              <form action={applyAction}>
                <input type="hidden" name="runId" value={state.runId} readOnly />
                <ApplyButton disabled={state.updateCount === 0} />
              </form>
            ) : null}
          </div>

          <dl className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-3">
            <MetricCard label="Processed Rows" value={state.processedRows} />
            <MetricCard label="Passed Rows (Y)" value={state.passedRows} />
            <MetricCard label="Safe Updates" value={state.updateCount} />
            <MetricCard label="Skipped Rows" value={state.skippedCount} />
            <MetricCard label="Ambiguous Rows" value={state.ambiguousCount} />
            <MetricCard label="Applied Updates" value={state.appliedCount} />
          </dl>

          <div className="mt-6 grid gap-6 xl:grid-cols-3">
            <PreviewSection
              title="Will Update"
              rows={state.updates}
              emptyMessage="No safe updates were found."
              tone="emerald"
            />
            <PreviewSection
              title="Skipped"
              rows={state.skipped}
              emptyMessage="No rows were skipped."
              tone="slate"
            />
            <PreviewSection
              title="Ambiguous"
              rows={state.ambiguous}
              emptyMessage="No ambiguous matches were found."
              tone="amber"
            />
          </div>
        </article>
      ) : null}
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass-card-soft">
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-xl font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function PreviewSection({
  title,
  rows,
  emptyMessage,
  tone,
}: {
  title: string;
  rows: ComplianceSyncState["updates"];
  emptyMessage: string;
  tone: "emerald" | "slate" | "amber";
}) {
  const toneClasses =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50"
        : "border-slate-200 bg-slate-50";

  return (
    <section className={`rounded-[1.25rem] border p-4 ${toneClasses}`}>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>

      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">{emptyMessage}</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {rows.map((row) => (
            <li key={`${title}-${row.rowNumber}`} className="glass-card-soft text-sm">
              <p className="font-semibold text-slate-900">
                Row {row.rowNumber}: {row.firstName} {row.lastName}
              </p>
              <p className="text-xs text-slate-500">
                Status: {row.status}
                {row.dateOfBirth ? ` • DOB: ${row.dateOfBirth}` : ""}
              </p>
              {row.matchedDisplayName ? (
                <p className="mt-1 text-sm text-slate-700">Match: {row.matchedDisplayName}</p>
              ) : null}
              <p className="mt-1 text-sm text-slate-700">{row.reason}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function PreviewButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">
      {pending ? "Generating Preview..." : "Preview Sync"}
    </button>
  );
}

function ApplyButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending || disabled} className="btn-primary disabled:opacity-60">
      {pending ? "Applying..." : "Apply Safe Updates"}
    </button>
  );
}
