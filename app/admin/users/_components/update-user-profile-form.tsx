"use client";

import { UserRole } from "@prisma/client";
import { useMemo, useState } from "react";
import { useFormState } from "react-dom";

import {
  adminCreateInitialState,
  updateUserProfileAction,
} from "../../../actions/admin-management-actions";

type UserOption = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

type UpdateUserProfileFormProps = {
  users: UserOption[];
};

export function UpdateUserProfileForm({ users }: UpdateUserProfileFormProps) {
  const [state, formAction] = useFormState(updateUserProfileAction, adminCreateInitialState);
  const [selectedUserId, setSelectedUserId] = useState<string>(users[0]?.id ?? "");

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [users, selectedUserId],
  );

  if (users.length === 0) {
    return null;
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Update User Profile</h2>
      <p className="mt-1 text-sm text-slate-600">Edit user name and role for an existing account.</p>

      <form action={formAction} className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
          <span>Select User</span>
          <select
            name="userId"
            value={selectedUserId}
            onChange={(event) => setSelectedUserId(event.currentTarget.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          >
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} ({user.email})
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm text-slate-700">
          <span>Name</span>
          <input
            key={`${selectedUserId}-name`}
            name="name"
            type="text"
            required
            defaultValue={selectedUser?.name ?? ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="space-y-1 text-sm text-slate-700">
          <span>Role</span>
          <select
            key={`${selectedUserId}-role`}
            name="role"
            defaultValue={selectedUser?.role ?? UserRole.CLUB_DIRECTOR}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          >
            {Object.values(UserRole).map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
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
            Update User
          </button>
        </div>
      </form>
    </article>
  );
}
