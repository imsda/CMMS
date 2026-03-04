"use client";

export function PrintManifestButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500 print:hidden"
    >
      Print Manifest
    </button>
  );
}
