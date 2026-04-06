"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function TeacherError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="glass-panel flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="glass-card-soft max-w-md space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Something went wrong</h2>
        <p className="text-sm text-slate-600">
          An unexpected error occurred while loading this page. Please try again or return to the dashboard.
        </p>
        {error.digest && (
          <p className="font-mono text-xs text-slate-400">Ref: {error.digest}</p>
        )}
        <div className="flex justify-center gap-3 pt-2">
          <button onClick={() => reset()} className="btn-primary">
            Try again
          </button>
          <Link href="/teacher/dashboard" className="btn-secondary">
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
