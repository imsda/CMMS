import Link from "next/link";

const attendees = [
  { name: "Avery Cole", role: "Pathfinder", status: "Complete" },
  { name: "Mason Reed", role: "Staff", status: "Needs clearance" },
  { name: "Lila Hayes", role: "Pathfinder", status: "Dietary form pending" },
  { name: "Ethan Cruz", role: "Counselor", status: "Complete" }
];

export default function EventRegistrationPreviewPage() {
  return (
    <section className="space-y-6">
      <header className="glass-panel">
        <p className="hero-kicker">Preview Only</p>
        <h1 className="hero-title mt-3">Event Registration</h1>
        <p className="hero-copy max-w-3xl">
          Static fake data showing an in-progress registration flow for a sample camporee weekend.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="glass-panel">
          <p className="hero-kicker">Sample Event</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Spring Camporee 2026</h2>
          <p className="mt-2 text-sm text-slate-600">
            April 12-14 • Lake Wapello Campgrounds • Pricing and roster below are placeholder content.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              ["Attendees selected", "4"],
              ["Base total", "$140"],
              ["Registration status", "Draft"]
            ].map(([label, value]) => (
              <div key={label} className="glass-card-soft">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
                <p className="mt-3 text-2xl font-semibold text-slate-950">{value}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="glass-panel">
          <p className="hero-kicker">Fake Questions</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">Dynamic form snapshot</h2>
          <div className="mt-5 space-y-3">
            {[
              "Does your club need electrical hookup? Yes",
              "Preferred campsite zone: North Ridge",
              "Camporee module selected: Orienteering + Drill"
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-700">
                {item}
              </div>
            ))}
          </div>
        </article>
      </div>

      <article className="glass-panel">
        <p className="hero-kicker">Attendee List</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-950">Selected roster members</h2>
        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 bg-white/80 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {attendees.map((attendee) => (
                <tr key={attendee.name}>
                  <td className="px-4 py-3 font-medium text-slate-900">{attendee.name}</td>
                  <td className="px-4 py-3">{attendee.role}</td>
                  <td className="px-4 py-3">{attendee.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <Link href="/previews" className="btn-secondary inline-flex">
        Back to Preview Index
      </Link>
    </section>
  );
}
