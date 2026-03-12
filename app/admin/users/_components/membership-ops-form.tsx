"use client";

import { useFormState } from "react-dom";

import { adminCreateInitialState } from "../../../actions/admin-management-state";
import {
  removeUserMembershipAction,
  setPrimaryMembershipAction,
} from "../../../actions/admin-management-actions";

type MembershipOption = {
  id: string;
  userName: string;
  clubName: string;
  clubCode: string;
  isPrimary: boolean;
};

type MembershipOpsFormProps = {
  memberships: MembershipOption[];
};

export function MembershipOpsForm({ memberships }: MembershipOpsFormProps) {
  const [primaryState, setPrimaryAction] = useFormState(
    setPrimaryMembershipAction,
    adminCreateInitialState,
  );
  const [removeState, removeAction] = useFormState(
    removeUserMembershipAction,
    adminCreateInitialState,
  );

  if (memberships.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Set Primary Membership</h2>
        <form action={setPrimaryAction} className="mt-4 space-y-3">
          <label className="space-y-1 text-sm text-slate-700">
            <span>Membership</span>
            <select
              name="membershipId"
              defaultValue={memberships[0]?.id}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              {memberships.map((membership) => (
                <option key={membership.id} value={membership.id}>
                  {membership.userName} {" -> "} {membership.clubName} ({membership.clubCode})
                  {membership.isPrimary ? " [PRIMARY]" : ""}
                </option>
              ))}
            </select>
          </label>

          {primaryState.status !== "idle" && primaryState.message ? (
            <p
              className={`rounded-lg px-3 py-2 text-sm ${
                primaryState.status === "error"
                  ? "border border-rose-200 bg-rose-50 text-rose-700"
                  : "border border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              {primaryState.message}
            </p>
          ) : null}

          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Set Primary
          </button>
        </form>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Remove Membership</h2>
        <form action={removeAction} className="mt-4 space-y-3">
          <label className="space-y-1 text-sm text-slate-700">
            <span>Membership</span>
            <select
              name="membershipId"
              defaultValue={memberships[0]?.id}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              {memberships.map((membership) => (
                <option key={membership.id} value={membership.id}>
                  {membership.userName} {" -> "} {membership.clubName} ({membership.clubCode})
                  {membership.isPrimary ? " [PRIMARY]" : ""}
                </option>
              ))}
            </select>
          </label>

          {removeState.status !== "idle" && removeState.message ? (
            <p
              className={`rounded-lg px-3 py-2 text-sm ${
                removeState.status === "error"
                  ? "border border-rose-200 bg-rose-50 text-rose-700"
                  : "border border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              {removeState.message}
            </p>
          ) : null}

          <button
            type="submit"
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500"
          >
            Remove Membership
          </button>
        </form>
      </article>
    </div>
  );
}
