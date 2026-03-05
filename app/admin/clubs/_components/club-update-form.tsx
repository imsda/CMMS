"use client";

import { ClubType } from "@prisma/client";
import { useMemo, useState } from "react";
import { useFormState } from "react-dom";

import {
  adminCreateInitialState,
  updateClubAction,
} from "../../../actions/admin-management-actions";

type ClubOption = {
  id: string;
  name: string;
  code: string;
  type: ClubType;
  city: string | null;
  state: string | null;
};

type ClubUpdateFormProps = {
  clubs: ClubOption[];
};

export function ClubUpdateForm({ clubs }: ClubUpdateFormProps) {
  const [state, formAction] = useFormState(updateClubAction, adminCreateInitialState);
  const [selectedClubId, setSelectedClubId] = useState<string>(clubs[0]?.id ?? "");

  const selectedClub = useMemo(
    () => clubs.find((club) => club.id === selectedClubId) ?? null,
    [clubs, selectedClubId],
  );

  if (clubs.length === 0) {
    return null;
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Update Club</h2>
      <p className="mt-1 text-sm text-slate-600">Edit name/code/type and location for an existing club.</p>

      <form action={formAction} className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
          <span>Select Club</span>
          <select
            name="clubId"
            value={selectedClubId}
            onChange={(event) => setSelectedClubId(event.currentTarget.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          >
            {clubs.map((club) => (
              <option key={club.id} value={club.id}>
                {club.name} ({club.code})
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
          <span>Club Name</span>
          <input
            key={`${selectedClubId}-name`}
            name="name"
            type="text"
            required
            defaultValue={selectedClub?.name ?? ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="space-y-1 text-sm text-slate-700">
          <span>Club Code</span>
          <input
            key={`${selectedClubId}-code`}
            name="code"
            type="text"
            required
            defaultValue={selectedClub?.code ?? ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="space-y-1 text-sm text-slate-700">
          <span>Club Type</span>
          <select
            key={`${selectedClubId}-type`}
            name="type"
            defaultValue={selectedClub?.type ?? ClubType.PATHFINDER}
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
            key={`${selectedClubId}-city`}
            name="city"
            type="text"
            defaultValue={selectedClub?.city ?? ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="space-y-1 text-sm text-slate-700">
          <span>State (optional)</span>
          <input
            key={`${selectedClubId}-state`}
            name="state"
            type="text"
            defaultValue={selectedClub?.state ?? ""}
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
            Update Club
          </button>
        </div>
      </form>
    </article>
  );
}
