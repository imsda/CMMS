"use client";

import { useFormState } from "react-dom";

import {
  generateTltRecommendationLinks,
  type RecommendationInviteActionState,
} from "../../../../../actions/tlt-recommendation-actions";

type RecommendationLinkGeneratorProps = {
  tltApplicationId: string;
  emailConfigured: boolean;
};

const INITIAL_STATE: RecommendationInviteActionState = {
  status: "idle",
  message: null,
};

export function RecommendationLinkGenerator({
  tltApplicationId,
  emailConfigured,
}: RecommendationLinkGeneratorProps) {
  const [state, formAction] = useFormState(generateTltRecommendationLinks, INITIAL_STATE);

  return (
    <form action={formAction} className="mt-4 space-y-4">
      <input type="hidden" name="tltApplicationId" value={tltApplicationId} />

      {[1, 2, 3].map((slot) => (
        <div key={slot} className="space-y-1">
          <label htmlFor={`recommender-email-${slot}`} className="text-sm font-medium text-slate-700">
            Recommender {slot} email
          </label>
          <input
            id={`recommender-email-${slot}`}
            name="recommenderEmails"
            type="email"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-indigo-200 focus:ring"
            placeholder="name@example.com"
          />
        </div>
      ))}

      {state.status === "error" && state.message ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {state.message}
        </p>
      ) : null}

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          name="sendEmails"
          type="checkbox"
          disabled={!emailConfigured}
          className="h-4 w-4 rounded border-slate-300 text-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
        />
        Send invitation emails now (requires RESEND configuration)
      </label>

      <button
        type="submit"
        className="inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
      >
        Generate 3 Secure Links
      </button>
    </form>
  );
}
