"use client";

import { useFormState } from "react-dom";

import { adminCreateInitialState } from "../../../actions/admin-management-state";
import {
  assignUserMembershipAction,
} from "../../../actions/admin-management-actions";

type UserOption = {
  id: string;
  name: string;
  email: string;
};

type ClubOption = {
  id: string;
  name: string;
  code: string;
};

type UserMembershipFormProps = {
  users: UserOption[];
  clubs: ClubOption[];
};

export function UserMembershipForm({ users, clubs }: UserMembershipFormProps) {
  const [state, formAction] = useFormState(assignUserMembershipAction, adminCreateInitialState);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Assign Club Membership</h2>
      <p className="mt-1 text-sm text-slate-600">
        Add or update a user&apos;s club membership and optionally set it as primary.
      </p>

      <form action={formAction} className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm text-slate-700">
          <span>User</span>
          <select name="userId" required defaultValue="" className="w-full rounded-lg border border-slate-300 px-3 py-2">
            <option value="" disabled>
              Select a user
            </option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} ({user.email})
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm text-slate-700">
          <span>Club</span>
          <select name="clubId" required defaultValue="" className="w-full rounded-lg border border-slate-300 px-3 py-2">
            <option value="" disabled>
              Select a club
            </option>
            {clubs.map((club) => (
              <option key={club.id} value={club.id}>
                {club.name} ({club.code})
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm text-slate-700">
          <span>Title (optional)</span>
          <input
            name="membershipTitle"
            type="text"
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            placeholder="Assistant Director"
          />
        </label>

        <label className="mt-6 inline-flex items-center gap-2 text-sm text-slate-700">
          <input name="isPrimary" type="checkbox" className="h-4 w-4 rounded border-slate-300" />
          Set as primary membership
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
            Save Membership
          </button>
        </div>
      </form>
    </article>
  );
}
