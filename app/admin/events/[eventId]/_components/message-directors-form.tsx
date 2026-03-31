"use client";

import { useFormState } from "react-dom";
import { useState } from "react";

import {
  sendEventBroadcast,
  getEventBroadcastRecipientCount,
} from "../../../../actions/event-admin-actions";
import { sendEventBroadcastInitialState } from "../../../../actions/event-admin-state";

type Filter = "ALL" | "APPROVED_ONLY" | "PENDING_PAYMENT_ONLY";

type MessageDirectorsFormProps = {
  eventId: string;
};

export function MessageDirectorsForm({ eventId }: MessageDirectorsFormProps) {
  const [state, formAction] = useFormState(
    sendEventBroadcast,
    sendEventBroadcastInitialState,
  );
  const [filter, setFilter] = useState<Filter>("ALL");
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  async function handlePreview() {
    setLoadingCount(true);
    try {
      const count = await getEventBroadcastRecipientCount(eventId, filter);
      setRecipientCount(count);
    } finally {
      setLoadingCount(false);
    }
    setConfirmed(false);
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="filter" value={filter} />

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm text-slate-700">
          <span>Subject</span>
          <input
            name="subject"
            type="text"
            required
            placeholder="Important update about your registration"
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <div className="space-y-1 text-sm text-slate-700">
          <span>Recipients</span>
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as Filter);
              setRecipientCount(null);
              setConfirmed(false);
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          >
            <option value="ALL">All registered clubs</option>
            <option value="APPROVED_ONLY">Approved only</option>
            <option value="PENDING_PAYMENT_ONLY">Pending payment only</option>
          </select>
        </div>

        <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
          <span>Message</span>
          <textarea
            name="body"
            required
            rows={6}
            placeholder="Write your message here. Each line will become a paragraph."
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
      </div>

      {/* Preview / recipient count */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handlePreview}
          disabled={loadingCount}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-50"
        >
          {loadingCount ? "Checking..." : "Preview Recipients"}
        </button>

        {recipientCount !== null ? (
          <p className="text-sm text-slate-700">
            <strong>{recipientCount}</strong> director(s) will receive this
            message.
            {recipientCount > 0 ? (
              <button
                type="button"
                onClick={() => setConfirmed(true)}
                className="ml-3 text-indigo-600 underline hover:text-indigo-800"
              >
                Confirm and Send
              </button>
            ) : null}
          </p>
        ) : null}
      </div>

      {confirmed ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">
            You are about to send this message to {recipientCount} director(s).
            This action cannot be undone.
          </p>
          <div className="mt-3 flex gap-3">
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Send Message
            </button>
            <button
              type="button"
              onClick={() => setConfirmed(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {state.status === "success" && state.message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.message}
        </p>
      ) : null}

      {state.status === "error" && state.message ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
