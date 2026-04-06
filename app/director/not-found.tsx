import Link from "next/link";

export default function DirectorNotFound() {
  return (
    <div className="glass-panel mx-auto max-w-lg py-12 text-center">
      <h2 className="text-lg font-semibold text-slate-900">Page not found</h2>
      <p className="mt-2 text-sm text-slate-600">
        This director page does not exist or has been moved.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link href="/director/dashboard" className="btn-primary">
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
