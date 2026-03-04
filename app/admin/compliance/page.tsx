"use client";

import { useFormState, useFormStatus } from "react-dom";

import {
  initialComplianceSyncState,
  syncSterlingBackgroundChecks,
} from "../../actions/compliance-actions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Syncing..." : "Sync Background Checks"}
    </button>
  );
}

export default function ComplianceDashboardPage() {
  const [state, formAction] = useFormState(
    syncSterlingBackgroundChecks,
    initialComplianceSyncState,
  );

  return (
    <section className="space-y-8">
      <header>
        <p className="text-sm font-medium text-slate-500">Super Admin Dashboard</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Compliance Sync Engine</h1>
        <p className="mt-1 text-sm text-slate-600">
          Upload a Sterling Volunteers export to sync adult background check clearance.
        </p>
      </header>

      <form action={formAction} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <label
          htmlFor="sterlingCsv"
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center"
        >
          <span className="text-sm font-semibold text-slate-700">Drop CSV here or click to browse</span>
          <span className="text-xs text-slate-500">
            Accepted format: .csv with First Name, Last Name, and Status columns.
          </span>
          <input
            id="sterlingCsv"
            name="sterlingCsv"
            type="file"
            accept=".csv,text/csv"
            required
            className="mt-2 block w-full max-w-xs rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-indigo-500"
          />
        </label>

        <SubmitButton />
      </form>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Last Sync Result</h2>
        <p
          className={`mt-2 text-sm ${
            state.status === "error"
              ? "text-rose-600"
              : state.status === "success"
                ? "text-emerald-700"
                : "text-slate-600"
          }`}
        >
          {state.message}
        </p>

        <dl className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
          <div className="rounded-lg bg-slate-50 p-3">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Processed Rows</dt>
            <dd className="text-xl font-semibold text-slate-900">{state.processedRows}</dd>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Passed Rows (Y)</dt>
            <dd className="text-xl font-semibold text-slate-900">{state.passedRows}</dd>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Updated Members</dt>
            <dd className="text-xl font-semibold text-slate-900">{state.updatedCount}</dd>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Unmatched Rows</dt>
            <dd className="text-xl font-semibold text-slate-900">{state.unmatchedCount}</dd>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 md:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Skipped Rows (Status ≠ Y)</dt>
            <dd className="text-xl font-semibold text-slate-900">{state.skippedCount}</dd>
          </div>
        </dl>
      </article>
    </section>
  );
}
