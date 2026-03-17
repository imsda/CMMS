export default function AdminEventTemplatesLoading() {
  return (
    <div className="glass-panel animate-pulse space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-44 rounded-md bg-slate-200" />
          <div className="h-4 w-64 rounded-md bg-slate-200" />
        </div>
        <div className="h-8 w-32 rounded-md bg-slate-200" />
      </div>

      {/* 2-column card grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="glass-card-soft space-y-3">
            <div className="flex items-start justify-between">
              <div className="h-5 w-40 rounded bg-slate-200" />
              <div className="h-5 w-16 rounded-full bg-slate-200" />
            </div>
            <div className="space-y-1.5">
              <div className="h-3 w-full rounded bg-slate-200" />
              <div className="h-3 w-5/6 rounded bg-slate-200" />
            </div>
            <div className="flex gap-2 pt-1">
              <div className="h-7 w-16 rounded-md bg-slate-200" />
              <div className="h-7 w-16 rounded-md bg-slate-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
