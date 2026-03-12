"use client";

import { ClubType } from "@prisma/client";
import { useFormState } from "react-dom";

import { adminCreateInitialState } from "../../../actions/admin-management-state";
import {
  createClubAction,
} from "../../../actions/admin-management-actions";

export function ClubCreateForm() {
  const [state, formAction] = useFormState(createClubAction, adminCreateInitialState);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Create Club</h2>
      <p className="mt-1 text-sm text-slate-600">Add a new club so directors and users can be assigned.</p>

      <form action={formAction} className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
          <span>Club Name</span>
          <input
            name="name"
            type="text"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            placeholder="Cedar Rapids Pathfinders"
          />
        </label>

        <label className="space-y-1 text-sm text-slate-700">
          <span>Club Code</span>
          <input
            name="code"
            type="text"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            placeholder="CR-PF-001"
          />
        </label>

        <label className="space-y-1 text-sm text-slate-700">
          <span>Club Type</span>
          <select
            name="type"
            required
            defaultValue={ClubType.PATHFINDER}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          >
            {Object.values(ClubType).map((clubType) => (
              <option key={clubType} value={clubType}>
                {clubType}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm text-slate-700">
          <span>City (optional)</span>
          <input
            name="city"
            type="text"
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="space-y-1 text-sm text-slate-700">
          <span>State (optional)</span>
          <input
            name="state"
            type="text"
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        {state.status === "error" && state.message ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 md:col-span-2">
            {state.message}
          </p>
        ) : null}

        {state.status === "success" && state.message ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 md:col-span-2">
            {state.message}
          </p>
        ) : null}

        <div className="md:col-span-2">
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Create Club
          </button>
        </div>
      </form>
    </article>
  );
}
