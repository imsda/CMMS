"use client";

import { useState } from "react";

import { archiveEventTemplate } from "../../../../actions/event-admin-actions";

export function ArchiveTemplateButton({ templateId }: { templateId: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        className="btn-secondary"
        onClick={() => setConfirming(true)}
      >
        Archive
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-slate-700">Confirm archive?</span>
      <form action={archiveEventTemplate}>
        <input type="hidden" name="templateId" value={templateId} readOnly />
        <button type="submit" className="btn-secondary text-red-600">
          Confirm
        </button>
      </form>
      <button
        type="button"
        className="btn-secondary"
        onClick={() => setConfirming(false)}
      >
        Cancel
      </button>
    </div>
  );
}
