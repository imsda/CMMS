export default function StudentLoading() {
  return (
    <div className="glass-panel animate-pulse space-y-6">
      <div className="space-y-2">
        <div className="h-6 w-52 rounded-md bg-slate-200" />
        <div className="h-4 w-80 rounded-md bg-slate-200" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="glass-card-soft space-y-2">
            <div className="h-3 w-24 rounded bg-slate-200" />
            <div className="h-8 w-14 rounded bg-slate-200" />
            <div className="h-3 w-28 rounded bg-slate-200" />
          </div>
        ))}
      </div>

      <div className="glass-card-soft space-y-3">
        <div className="h-5 w-36 rounded bg-slate-200" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="h-4 w-2/3 rounded bg-slate-200" />
            <div className="h-4 w-16 rounded bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
