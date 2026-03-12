"use client";

import { useFormState } from "react-dom";

import { adminCreateInitialState } from "../../../actions/admin-management-state";
import {
  resetUserPasswordAction,
} from "../../../actions/admin-management-actions";

type UserOption = {
  id: string;
  name: string;
  email: string;
};

type ResetPasswordFormProps = {
  users: UserOption[];
};

export function ResetPasswordForm({ users }: ResetPasswordFormProps) {
  const [state, formAction] = useFormState(resetUserPasswordAction, adminCreateInitialState);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Reset User Password</h2>
      <p className="mt-1 text-sm text-slate-600">
        Set a new temporary password for an existing user account.
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
          <span>New Password</span>
          <input
            name="newPassword"
            type="password"
            minLength={8}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 md:col-span-2">
          <input
            name="sendResetEmail"
            type="checkbox"
            defaultChecked
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          Send reset email with temporary password
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
            Reset Password
          </button>
        </div>
      </form>
    </article>
  );
}
