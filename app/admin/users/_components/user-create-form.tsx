"use client";

import { UserRole } from "@prisma/client";
import { useMemo, useState } from "react";
import { useFormState } from "react-dom";

import { adminCreateInitialState } from "../../../actions/admin-management-state";
import {
  createUserAction,
} from "../../../actions/admin-management-actions";

type ClubOption = {
  id: string;
  name: string;
  code: string;
};

type UserCreateFormProps = {
  clubs: ClubOption[];
};

export function UserCreateForm({ clubs }: UserCreateFormProps) {
  const [state, formAction] = useFormState(createUserAction, adminCreateInitialState);
  const [role, setRole] = useState<UserRole>(UserRole.CLUB_DIRECTOR);

  const requiresClub = useMemo(() => role !== UserRole.SUPER_ADMIN, [role]);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Create User</h2>
      <p className="mt-1 text-sm text-slate-600">
        Add login credentials and optionally assign primary club membership.
      </p>

      <form action={formAction} className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm text-slate-700">
          <span>Full Name</span>
          <input
            name="name"
            type="text"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            placeholder="Jane Director"
          />
        </label>

        <label className="space-y-1 text-sm text-slate-700">
          <span>Email</span>
          <input
            name="email"
            type="email"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            placeholder="jane@club.org"
          />
        </label>

        <label className="space-y-1 text-sm text-slate-700">
          <span>Role</span>
          <select
            name="role"
            value={role}
            onChange={(event) => setRole(event.currentTarget.value as UserRole)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          >
            {Object.values(UserRole).map((userRole) => (
              <option key={userRole} value={userRole}>
                {userRole}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm text-slate-700">
          <span>Temporary Password</span>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="space-y-1 text-sm text-slate-700">
          <span>Primary Club {requiresClub ? "(required)" : "(optional)"}</span>
          <select
            name="primaryClubId"
            required={requiresClub}
            defaultValue=""
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          >
            <option value="">None</option>
            {clubs.map((club) => (
              <option key={club.id} value={club.id}>
                {club.name} ({club.code})
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm text-slate-700">
          <span>Membership Title (optional)</span>
          <input
            name="membershipTitle"
            type="text"
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            placeholder="Club Director"
          />
        </label>

        <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 md:col-span-2">
          <input
            name="sendInviteEmail"
            type="checkbox"
            defaultChecked
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          Send invite email with temporary password
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
            Create User
          </button>
        </div>
      </form>
    </article>
  );
}
