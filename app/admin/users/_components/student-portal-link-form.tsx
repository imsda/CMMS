"use client";

import { useFormState } from "react-dom";

import { adminCreateInitialState } from "../../../actions/admin-management-state";
import {
  assignStudentPortalLinkAction,
  removeStudentPortalLinkAction,
} from "../../../actions/admin-management-actions";

type UserOption = {
  id: string;
  name: string;
  email: string;
};

type RosterMemberOption = {
  id: string;
  firstName: string;
  lastName: string;
  memberRole: string;
  clubName: string;
  clubCode: string;
  rosterYearLabel: string;
};

type ExistingLink = {
  id: string;
  userName: string;
  userEmail: string;
  rosterMemberName: string;
  memberRole: string;
  clubName: string;
  clubCode: string;
  rosterYearLabel: string;
};

type StudentPortalLinkFormProps = {
  users: UserOption[];
  rosterMembers: RosterMemberOption[];
  existingLinks: ExistingLink[];
};

function StateMessage({
  status,
  message,
}: {
  status: "idle" | "success" | "error";
  message: string | null;
}) {
  if (!message || status === "idle") {
    return null;
  }

  return (
    <p
      className={`rounded-lg px-3 py-2 text-sm ${
        status === "error"
          ? "border border-rose-200 bg-rose-50 text-rose-700"
          : "border border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      {message}
    </p>
  );
}

export function StudentPortalLinkForm({
  users,
  rosterMembers,
  existingLinks,
}: StudentPortalLinkFormProps) {
  const [assignState, assignAction] = useFormState(
    assignStudentPortalLinkAction,
    adminCreateInitialState,
  );
  const [removeState, removeAction] = useFormState(
    removeStudentPortalLinkAction,
    adminCreateInitialState,
  );

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Manage Student Portal Links</h2>
      <p className="mt-1 text-sm text-slate-600">
        Explicitly link STUDENT_PARENT accounts to the roster members they are allowed to view.
      </p>

      <form action={assignAction} className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm text-slate-700">
          <span>Portal user</span>
          <select name="userId" required defaultValue="" className="w-full rounded-lg border border-slate-300 px-3 py-2">
            <option value="" disabled>
              Select a STUDENT_PARENT user
            </option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} ({user.email})
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm text-slate-700">
          <span>Roster member</span>
          <select
            name="rosterMemberId"
            required
            defaultValue=""
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          >
            <option value="" disabled>
              Select a student roster member
            </option>
            {rosterMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.lastName}, {member.firstName} ({member.memberRole}) - {member.clubName} ({member.clubCode}) / {member.rosterYearLabel}
              </option>
            ))}
          </select>
        </label>

        <div className="md:col-span-2">
          <StateMessage status={assignState.status} message={assignState.message} />
        </div>

        <div className="md:col-span-2">
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Save Student Link
          </button>
        </div>
      </form>

      <div className="mt-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Existing Portal Links
        </h3>
        <div className="mt-3">
          <StateMessage status={removeState.status} message={removeState.message} />
        </div>

        {existingLinks.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No student portal links have been configured yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Portal User</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Student</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Roster Year</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {existingLinks.map((link) => (
                  <tr key={link.id}>
                    <td className="px-4 py-3 text-slate-700">
                      <p className="font-medium text-slate-900">{link.userName}</p>
                      <p className="text-xs text-slate-500">{link.userEmail}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <p className="font-medium text-slate-900">{link.rosterMemberName}</p>
                      <p className="text-xs text-slate-500">
                        {link.memberRole} - {link.clubName} ({link.clubCode})
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{link.rosterYearLabel}</td>
                    <td className="px-4 py-3">
                      <form action={removeAction}>
                        <input type="hidden" name="linkId" value={link.id} readOnly />
                        <button
                          type="submit"
                          className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50"
                        >
                          Remove
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </article>
  );
}
