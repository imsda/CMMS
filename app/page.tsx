import Link from "next/link";

export default function HomePage() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
      <p className="text-sm font-medium text-indigo-700">System Bootstrap Complete</p>
      <h2 className="mt-2 text-3xl font-semibold text-slate-900">
        Club Management Platform
      </h2>
      <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-600">
        Jump into the Club Director dashboard shell to continue building roster rollover,
        event registration, and class enrollment workflows.
      </p>
      <Link
        href="/director/dashboard"
        className="mt-6 inline-flex rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
      >
        Open Director Dashboard
      </Link>
    </section>
  );
}
