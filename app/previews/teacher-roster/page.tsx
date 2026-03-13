import Link from "next/link";

const students = [
  { name: "Ava Turner", attended: "Present", completion: "Signed off" },
  { name: "Noah Brooks", attended: "Present", completion: "Pending" },
  { name: "Mia Foster", attended: "Absent", completion: "Pending" },
  { name: "Lucas James", attended: "Present", completion: "Signed off" }
];

export default function TeacherRosterPreviewPage() {
  return (
    <section className="space-y-6">
      <header className="glass-panel">
        <p className="hero-kicker">Preview Only</p>
        <h1 className="hero-title mt-3">Teacher Roster</h1>
        <p className="hero-copy max-w-3xl">
          Fake static roster data for an honor class view, showing the attendance and requirement sign-off layout.
        </p>
      </header>

      <article className="glass-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="hero-kicker">Sample Class</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">First Aid Honor</h2>
            <p className="mt-2 text-sm text-slate-600">Spring Camporee 2026 • Instructor: Riley Morgan</p>
          </div>
          <div className="glass-card-soft min-w-44">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Roster status</p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">3 / 4 attended</p>
            <p className="mt-2 text-sm text-slate-600">2 completions signed off</p>
          </div>
        </div>
      </article>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {students.map((student) => (
          <article key={student.name} className="glass-card">
            <p className="text-lg font-semibold text-slate-950">{student.name}</p>
            <p className="mt-2 text-sm text-slate-500">Attendance</p>
            <p className="text-sm font-medium text-slate-800">{student.attended}</p>
            <p className="mt-3 text-sm text-slate-500">Requirement sign-off</p>
            <p className="text-sm font-medium text-slate-800">{student.completion}</p>
          </article>
        ))}
      </div>

      <Link href="/previews" className="btn-secondary inline-flex">
        Back to Preview Index
      </Link>
    </section>
  );
}
