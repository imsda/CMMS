import Link from "next/link";

export default function DirectorDashboardPreviewPage() {
  const cards = [
    { label: "Roster readiness", value: "92%", note: "3 follow-ups remaining" },
    { label: "Upcoming events", value: "4", note: "2 need submission" },
    { label: "Monthly reports", value: "On track", note: "April report drafted" },
    { label: "Compliance", value: "7 alerts", note: "Adult clearance gaps" }
  ];

  const tasks = [
    "Finalize Spring Camporee registration",
    "Upload two missing insurance cards",
    "Resolve one duplicate parent contact",
    "Review TLT recommendation progress"
  ];

  return (
    <section className="space-y-6">
      <header className="glass-panel">
        <p className="hero-kicker">Preview Only</p>
        <h1 className="hero-title mt-3">Director Dashboard</h1>
        <p className="hero-copy max-w-3xl">
          Fake static data for a club director overview. This page is intentionally read-only and meant for UI review.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article key={card.label} className="glass-card-soft">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{card.label}</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{card.value}</p>
            <p className="mt-2 text-sm text-slate-600">{card.note}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="glass-panel">
          <p className="hero-kicker">Readiness Board</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">North Valley Pathfinders</h2>
          <p className="mt-2 text-sm text-slate-600">
            Fake sample club with an active 2026 roster year, one draft registration, and mild compliance drift.
          </p>

          <div className="mt-6 space-y-3">
            {[
              ["Active roster year", "2026-2027"],
              ["Current month", "April 2026"],
              ["Latest report", "Submitted for March"],
              ["Primary director", "Jordan Lee"]
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/70 px-4 py-3">
                <span className="text-sm text-slate-500">{label}</span>
                <span className="text-sm font-semibold text-slate-900">{value}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="glass-panel">
          <p className="hero-kicker">Next Actions</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">Sample follow-up queue</h2>
          <div className="mt-5 space-y-3">
            {tasks.map((task, index) => (
              <div key={task} className="glass-card-soft flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                  {index + 1}
                </div>
                <p className="text-sm text-slate-700">{task}</p>
              </div>
            ))}
          </div>
        </article>
      </div>

      <Link href="/previews" className="btn-secondary inline-flex">
        Back to Preview Index
      </Link>
    </section>
  );
}
