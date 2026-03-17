export default function DirectorEventLoading() {
  return (
    <div className="glass-panel animate-pulse space-y-6">
      {/* Event title */}
      <div className="space-y-2">
        <div className="h-7 w-64 rounded-md bg-slate-200" />
        <div className="h-4 w-48 rounded-md bg-slate-200" />
      </div>

      {/* Registration form skeleton */}
      <div className="glass-card-soft space-y-5">
        <div className="h-5 w-44 rounded bg-slate-200" />

        {/* Form field rows */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-3 w-28 rounded bg-slate-200" />
            <div className="h-10 w-full rounded-lg bg-slate-200" />
          </div>
        ))}

        {/* Attendees section */}
        <div className="space-y-3 pt-2">
          <div className="h-4 w-32 rounded bg-slate-200" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-slate-200" />
              <div className="h-4 w-40 rounded bg-slate-200" />
              <div className="ml-auto h-4 w-20 rounded bg-slate-200" />
            </div>
          ))}
        </div>

        {/* Submit button */}
        <div className="flex justify-end pt-2">
          <div className="h-10 w-32 rounded-lg bg-slate-200" />
        </div>
      </div>
    </div>
  );
}
