import Link from "next/link";

export default function StudentPortalPreviewPage() {
  return (
    <section className="space-y-6">
      <header className="glass-panel">
        <p className="hero-kicker">Preview Only</p>
        <h1 className="hero-title mt-3">Student Portal</h1>
        <p className="hero-copy max-w-3xl">
          Fake linked-family preview showing how upcoming events, readiness notes, and student records can be presented.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <article className="glass-panel">
          <p className="hero-kicker">Linked Members</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Family snapshot</h2>
          <div className="mt-5 space-y-3">
            {[
              "Ella Green • Pathfinder • Active",
              "Caleb Green • Adventurer • Active"
            ].map((member) => (
              <div key={member} className="glass-card-soft text-sm text-slate-700">
                {member}
              </div>
            ))}
          </div>
        </article>

        <article className="glass-panel">
          <p className="hero-kicker">Upcoming Items</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Sample event and form notices</h2>
          <div className="mt-5 grid gap-3">
            {[
              "Spring Camporee registration closes in 5 days",
              "Medical treatment consent is on file",
              "Insurance card upload needed for one linked member"
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-700">
                {item}
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
