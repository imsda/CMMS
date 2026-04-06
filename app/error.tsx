"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function RootError({
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
    <div className="glass-panel mx-auto flex max-w-lg flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="glass-card-soft max-w-md space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Something went wrong</h2>
        <p className="text-sm text-slate-600">
          An unexpected error occurred. Please try again or return to the home page.
        </p>
        {error.digest && (
          <p className="font-mono text-xs text-slate-400">Ref: {error.digest}</p>
        )}
        <div className="flex justify-center gap-3 pt-2">
          <button onClick={() => reset()} className="btn-primary">
            Try again
          </button>
          <Link href="/" className="btn-secondary">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
