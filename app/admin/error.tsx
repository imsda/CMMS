"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="glass-panel flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="glass-card-soft max-w-md space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Something went wrong</h2>
        <p className="text-sm text-slate-600">
          An unexpected error occurred while loading this page.
        </p>
        {error.digest && (
          <p className="font-mono text-xs text-slate-400">Ref: {error.digest}</p>
        )}
        <div className="flex justify-center gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Try again
          </button>
          <button
            onClick={() => router.push("/admin/dashboard")}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Go to dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
