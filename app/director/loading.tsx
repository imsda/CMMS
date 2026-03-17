export default function DirectorLoading() {
  return (
    <div className="glass-panel animate-pulse space-y-6">
      {/* Page header */}
      <div className="space-y-2">
        <div className="h-6 w-52 rounded-md bg-slate-200" />
        <div className="h-4 w-80 rounded-md bg-slate-200" />
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-card-soft space-y-2">
            <div className="h-3 w-24 rounded bg-slate-200" />
            <div className="h-8 w-14 rounded bg-slate-200" />
            <div className="h-3 w-28 rounded bg-slate-200" />
          </div>
        ))}
      </div>

      {/* Main content panels */}
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="glass-card-soft space-y-3">
            <div className="h-5 w-32 rounded bg-slate-200" />
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="flex items-center justify-between">
                <div className="h-4 w-2/3 rounded bg-slate-200" />
                <div className="h-4 w-16 rounded bg-slate-200" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
