export default function AdminEventsLoading() {
  return (
    <div className="glass-panel animate-pulse space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="h-6 w-40 rounded-md bg-slate-200" />
        <div className="h-8 w-28 rounded-md bg-slate-200" />
      </div>

      {/* Table skeleton */}
      <div className="glass-card-soft overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-5 gap-4 border-b border-slate-200 pb-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-4 rounded bg-slate-200" />
          ))}
        </div>

        {/* Table rows */}
        {Array.from({ length: 4 }).map((_, row) => (
          <div
            key={row}
            className="grid grid-cols-5 gap-4 border-b border-slate-100 py-3 last:border-0"
          >
            {Array.from({ length: 5 }).map((_, col) => (
              <div
                key={col}
                className={`h-4 rounded bg-slate-200 ${col === 0 ? "w-3/4" : col === 4 ? "w-1/2" : ""}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
