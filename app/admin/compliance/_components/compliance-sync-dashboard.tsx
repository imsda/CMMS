"use client";

import { useFormState, useFormStatus } from "react-dom";

import {
  initialComplianceSyncState,
  type ComplianceSyncState,
} from "../../../actions/compliance-state";
import {
  applySterlingBackgroundChecksPreview,
  previewSterlingBackgroundChecks,
} from "../../../actions/compliance-actions";

type RosterYearOption = {
  id: string;
  yearLabel: string;
  isActive: boolean;
  club: {
    name: string;
    code: string;
  };
};

type ComplianceSyncDashboardProps = {
  rosterYears: RosterYearOption[];
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

export function ComplianceSyncDashboard({ rosterYears }: ComplianceSyncDashboardProps) {
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
      <header className="glass-panel">
        <p className="hero-kicker">Super Admin Dashboard</p>
        <h1 className="hero-title mt-3">Compliance Sync Engine</h1>
        <p className="hero-copy">
          Preview Sterling Volunteers CSV matches within a selected roster year or across the entire system before applying updates.
        </p>
      </header>

      <form action={previewAction} className="glass-panel space-y-5">
        <label className="block space-y-1 text-sm text-slate-700">
          <span>Sync scope</span>
          <select
            name="clubRosterYearId"
            required
            defaultValue="SYSTEM_WIDE"
            className="select-glass"
          >
            <option value="SYSTEM_WIDE">
              Entire system (all clubs and roster years)
            </option>
            {rosterYears.map((rosterYear) => (
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
    <button
      type="submit"
      disabled={pending}
      className="btn-primary disabled:opacity-60"
    >
      {pending ? "Generating Preview..." : "Preview Sync"}
    </button>
  );
}

function ApplyButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="btn-primary disabled:opacity-60"
    >
      {pending ? "Applying..." : "Apply Safe Updates"}
    </button>
  );
}
