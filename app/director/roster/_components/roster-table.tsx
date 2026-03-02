"use client";

import { Gender, MemberRole } from "@prisma/client";
import { useMemo, useState } from "react";

import { saveRosterMember } from "../../../actions/roster-actions";

type RosterMemberRow = {
  id: string;
  firstName: string;
  lastName: string;
  ageAtStart: number | null;
  gender: Gender | null;
  memberRole: MemberRole;
  medicalFlags: string | null;
  dietaryRestrictions: string | null;
  isFirstTime: boolean;
  isMedicalPersonnel: boolean;
  masterGuide: boolean;
  backgroundCheckDate: string | null;
  backgroundCheckCleared: boolean;
  dateOfBirth: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  insuranceCompany: string | null;
  insurancePolicyNumber: string | null;
  lastTetanusDate: string | null;
  photoReleaseConsent: boolean;
  medicalTreatmentConsent: boolean;
  membershipAgreementConsent: boolean;
  isActive: boolean;
};

type RosterTableProps = {
  rosterYearId: string;
  members: RosterMemberRow[];
};

type ModalState = {
  mode: "create" | "edit";
  member: RosterMemberRow | null;
};

const roleOptions = Object.values(MemberRole);
const genderOptions = Object.values(Gender);
const adultRoles = new Set<MemberRole>([MemberRole.STAFF, MemberRole.DIRECTOR, MemberRole.COUNSELOR]);

function Badge({ label, tone }: { label: string; tone: "neutral" | "good" | "warn" | "danger" }) {
  const toneClass =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : tone === "danger"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-slate-200 bg-slate-100 text-slate-700";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClass}`}>
      {label}
    </span>
  );
}

function toDateInputValue(value: string | null) {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
}

function formatDateLabel(value: string) {
  return new Date(value).toLocaleDateString();
}

function hasMissingRequiredConsent(member: RosterMemberRow) {
  return !(member.photoReleaseConsent && member.medicalTreatmentConsent && member.membershipAgreementConsent);
}

export function RosterTable({ rosterYearId, members }: RosterTableProps) {
  const [modalState, setModalState] = useState<ModalState | null>(null);

  const sortedMembers = useMemo(
    () =>
      [...members].sort((a, b) => {
        const byLastName = a.lastName.localeCompare(b.lastName);
        if (byLastName !== 0) {
          return byLastName;
        }

        return a.firstName.localeCompare(b.firstName);
      }),
    [members],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Roster Members</h2>
          <p className="text-sm text-slate-600">Manage the active members for the current roster year.</p>
        </div>
        <button
          type="button"
          onClick={() => setModalState({ mode: "create", member: null })}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
        >
          Add Member
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {[
                "Name",
                "Tags",
                "Role",
                "Background Check",
                "Consents",
                "Age",
                "Gender",
                "Medical",
                "Dietary",
                "Master Guide",
                "Actions",
              ].map((header) => (
                <th
                  key={header}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedMembers.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-sm text-slate-500">
                  No active members found in this roster year yet.
                </td>
              </tr>
            ) : (
              sortedMembers.map((member) => {
                const requiresCheck = adultRoles.has(member.memberRole);
                const missingClearance = requiresCheck && !member.backgroundCheckDate;
                const missingConsent = hasMissingRequiredConsent(member);

                return (
                  <tr key={member.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 text-sm font-semibold text-slate-800">
                      {member.firstName} {member.lastName}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {member.isMedicalPersonnel ? <Badge label="Medical" tone="good" /> : null}
                        {member.isFirstTime ? <Badge label="1st Year" tone="warn" /> : null}
                        {!member.isMedicalPersonnel && !member.isFirstTime ? <Badge label="—" tone="neutral" /> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{member.memberRole.replaceAll("_", " ")}</td>
                    <td className="px-4 py-3">
                      {!requiresCheck ? (
                        <Badge label="Not Required" tone="neutral" />
                      ) : missingClearance ? (
                        <Badge label="Missing Clearance" tone="danger" />
                      ) : (
                        <Badge
                          label={
                            member.backgroundCheckCleared
                              ? `Cleared ${formatDateLabel(member.backgroundCheckDate)}`
                              : `Date Logged ${formatDateLabel(member.backgroundCheckDate)}`
                          }
                          tone="good"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {missingConsent ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700" title="Missing one or more required consents">
                          ⚠️ Missing
                        </span>
                      ) : (
                        <Badge label="Complete" tone="good" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{member.ageAtStart ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {member.gender ? member.gender.replaceAll("_", " ") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {member.medicalFlags ? <Badge label="Flagged" tone="warn" /> : <Badge label="None" tone="neutral" />}
                    </td>
                    <td className="px-4 py-3">
                      {member.dietaryRestrictions ? <Badge label="Yes" tone="warn" /> : <Badge label="None" tone="neutral" />}
                    </td>
                    <td className="px-4 py-3">
                      {member.masterGuide ? <Badge label="Certified" tone="good" /> : <Badge label="No" tone="neutral" />}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setModalState({ mode: "edit", member })}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {modalState ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-900">
                {modalState.mode === "create" ? "Add roster member" : "Edit roster member"}
              </h3>
              <button
                type="button"
                onClick={() => setModalState(null)}
                className="rounded-lg px-2 py-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form action={saveRosterMember} className="space-y-6 px-6 py-5">
              <input type="hidden" name="clubRosterYearId" value={rosterYearId} />
              {modalState.member ? <input type="hidden" name="memberId" value={modalState.member.id} /> : null}

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1 text-sm font-medium text-slate-700">
                  First Name
                  <input
                    name="firstName"
                    required
                    defaultValue={modalState.member?.firstName ?? ""}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none"
                  />
                </label>

                <label className="space-y-1 text-sm font-medium text-slate-700">
                  Last Name
                  <input
                    name="lastName"
                    required
                    defaultValue={modalState.member?.lastName ?? ""}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none"
                  />
                </label>

                <label className="space-y-1 text-sm font-medium text-slate-700">
                  Role
                  <select
                    name="memberRole"
                    required
                    defaultValue={modalState.member?.memberRole ?? MemberRole.PATHFINDER}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none"
                  >
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {role.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-sm font-medium text-slate-700">
                  Age
                  <input
                    type="number"
                    min={0}
                    name="ageAtStart"
                    defaultValue={modalState.member?.ageAtStart ?? ""}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none"
                  />
                </label>

                <label className="space-y-1 text-sm font-medium text-slate-700">
                  Gender
                  <select
                    name="gender"
                    defaultValue={modalState.member?.gender ?? ""}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none"
                  >
                    <option value="">Prefer not to say</option>
                    {genderOptions.map((gender) => (
                      <option key={gender} value={gender}>
                        {gender.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-sm font-medium text-slate-700">
                  Date of Birth
                  <input
                    type="date"
                    name="dateOfBirth"
                    defaultValue={toDateInputValue(modalState.member?.dateOfBirth ?? null)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none"
                  />
                </label>

                <label className="space-y-1 text-sm font-medium text-slate-700">
                  Background Check Date
                  <input
                    type="date"
                    name="backgroundCheckDate"
                    defaultValue={toDateInputValue(modalState.member?.backgroundCheckDate ?? null)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none"
                  />
                  <p className="text-xs font-normal text-slate-500">Required for staff, directors, and counselors.</p>
                </label>

                <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2">
                  Medical Flags
                  <input
                    name="medicalFlags"
                    defaultValue={modalState.member?.medicalFlags ?? ""}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none"
                  />
                </label>

                <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2">
                  Dietary Restrictions
                  <input
                    name="dietaryRestrictions"
                    defaultValue={modalState.member?.dietaryRestrictions ?? ""}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none"
                  />
                </label>

                <label className="space-y-1 text-sm font-medium text-slate-700">
                  Emergency Contact Name
                  <input
                    name="emergencyContactName"
                    defaultValue={modalState.member?.emergencyContactName ?? ""}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none"
                  />
                </label>

                <label className="space-y-1 text-sm font-medium text-slate-700">
                  Emergency Contact Phone
                  <input
                    name="emergencyContactPhone"
                    defaultValue={modalState.member?.emergencyContactPhone ?? ""}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none"
                  />
                </label>

                <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    name="isFirstTime"
                    defaultChecked={modalState.member?.isFirstTime ?? false}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  First Time Member
                </label>

                <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    name="isMedicalPersonnel"
                    defaultChecked={modalState.member?.isMedicalPersonnel ?? false}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Medical Personnel
                </label>

                <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    name="masterGuide"
                    defaultChecked={modalState.member?.masterGuide ?? false}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Master Guide
                </label>

                <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    name="isActive"
                    defaultChecked={modalState.member?.isActive ?? true}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Active Member
                </label>
              </div>

              <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <h4 className="text-base font-semibold text-slate-900">Agreements &amp; Medical</h4>
                  <p className="text-sm text-slate-600">
                    Capture parent/guardian consent confirmations and key health record details.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-1 text-sm font-medium text-slate-700">
                    Insurance Company
                    <input
                      name="insuranceCompany"
                      defaultValue={modalState.member?.insuranceCompany ?? ""}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none"
                    />
                  </label>

                  <label className="space-y-1 text-sm font-medium text-slate-700">
                    Insurance Policy Number
                    <input
                      name="insurancePolicyNumber"
                      defaultValue={modalState.member?.insurancePolicyNumber ?? ""}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none"
                    />
                  </label>

                  <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2">
                    Last Tetanus Date
                    <input
                      type="date"
                      name="lastTetanusDate"
                      defaultValue={toDateInputValue(modalState.member?.lastTetanusDate ?? null)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none"
                    />
                  </label>
                </div>

                <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Required Consents</p>

                  <label className="flex items-start gap-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      name="photoReleaseConsent"
                      required
                      defaultChecked={modalState.member?.photoReleaseConsent ?? false}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>
                      <strong>Photo/Video Release:</strong> I authorize Pathfinder activities to capture and use photos/videos
                      of my child for club communications and ministry promotion.
                    </span>
                  </label>

                  <label className="flex items-start gap-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      name="medicalTreatmentConsent"
                      required
                      defaultChecked={modalState.member?.medicalTreatmentConsent ?? false}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>
                      <strong>Medical Treatment Consent:</strong> I authorize staff to secure emergency medical care when
                      I cannot be reached, including transport and treatment as needed.
                    </span>
                  </label>

                  <label className="flex items-start gap-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      name="membershipAgreementConsent"
                      required
                      defaultChecked={modalState.member?.membershipAgreementConsent ?? false}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>
                      <strong>Membership Agreement:</strong> I agree to Pathfinder participation standards, expectations,
                      and parent/guardian responsibilities for this membership year.
                    </span>
                  </label>
                </div>
              </section>

              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setModalState(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
                >
                  {modalState.mode === "create" ? "Create Member" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
