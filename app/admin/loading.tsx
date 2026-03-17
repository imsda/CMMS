export default function AdminLoading() {
  return (
    <div className="glass-panel animate-pulse space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-48 rounded-md bg-slate-200" />
          <div className="h-4 w-72 rounded-md bg-slate-200" />
        </div>
        <div className="h-8 w-24 rounded-md bg-slate-200" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-card-soft space-y-2">
            <div className="h-3 w-20 rounded bg-slate-200" />
            <div className="h-7 w-16 rounded bg-slate-200" />
            <div className="h-3 w-24 rounded bg-slate-200" />
          </div>
        ))}
      </div>

      {/* Content block */}
      <div className="glass-card-soft space-y-3">
        <div className="h-5 w-36 rounded bg-slate-200" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-4 w-full rounded bg-slate-200" />
        ))}
      </div>
    </div>
  );
}
