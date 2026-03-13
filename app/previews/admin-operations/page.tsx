import Link from "next/link";

export default function AdminOperationsPreviewPage() {
  const metrics = [
    ["Active clubs", "46"],
    ["Open events", "7"],
    ["Pending audits", "12"],
    ["Scheduled jobs", "Healthy"]
  ];

  const runs = [
    ["director-readiness-reminders", "Completed", "Processed 46 clubs, 18 emails sent"],
    ["inactive-insurance-card-cleanup", "Completed", "Purged 11 files"],
    ["auth-rate-limit-cleanup", "Completed", "Deleted 37 expired buckets"]
  ];

  return (
    <section className="space-y-6">
      <header className="glass-panel">
        <p className="hero-kicker">Preview Only</p>
        <h1 className="hero-title mt-3">Admin Operations</h1>
        <p className="hero-copy max-w-3xl">
          Fake static conference-level operations data for design review of admin dashboards and maintenance panels.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value]) => (
          <article key={label} className="glass-card-soft">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{value}</p>
          </article>
        ))}
      </div>

      <article className="glass-panel">
        <p className="hero-kicker">Recent Jobs</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-950">Scheduled maintenance snapshot</h2>
        <div className="mt-5 space-y-3">
          {runs.map(([job, status, summary]) => (
            <div key={job} className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-950">{job}</p>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                  {status}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-600">{summary}</p>
            </div>
          ))}
        </div>
      </article>

      <Link href="/previews" className="btn-secondary inline-flex">
        Back to Preview Index
      </Link>
    </section>
  );
}
