import Link from "next/link";

import { previewPages } from "./_preview-data";

export default function PreviewIndexPage() {
  return (
    <section className="space-y-8">
      <header className="glass-panel">
        <p className="hero-kicker">Public UI Previews</p>
        <h1 className="hero-title mt-3">Static Preview Index</h1>
        <p className="hero-copy max-w-3xl">
          These pages are fake, read-only previews meant for sharing UI direction without signing in or touching
          production workflows. All names, counts, statuses, and dates here are sample content.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {previewPages.map((preview) => (
          <article key={preview.slug} className="glass-card flex flex-col justify-between gap-5">
            <div>
              <p className="hero-kicker">{preview.kicker}</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">{preview.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{preview.summary}</p>
            </div>

            <Link href={`/previews/${preview.slug}`} className="btn-primary inline-flex w-fit">
              Open Preview
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
