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
  managedClubId: string | null;
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
      ? "status-chip-success"
      : tone === "warn"
        ? "status-chip-warning"
        : tone === "danger"
          ? "status-chip-danger"
          : "status-chip-neutral";

  return (
    <span className={toneClass}>
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

export function RosterTable({ rosterYearId, managedClubId, members }: RosterTableProps) {
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
          <h2 className="section-title">Roster Members</h2>
          <p className="section-copy">Manage the active members for the current roster year.</p>
        </div>
        <button
          type="button"
          onClick={() => setModalState({ mode: "create", member: null })}
          className="btn-primary"
        >
          Add Member
        </button>
      </div>

      <div className="glass-table table-shell overflow-hidden">
        <table>
          <thead>
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
          <tbody>
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
                  <tr key={member.id}>
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
                        <span className="status-chip-warning" title="Missing one or more required consents">
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
                        className="btn-secondary px-3 py-1.5 text-xs"
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
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 p-4 sm:p-6">
          <div className="flex min-h-full items-start justify-center py-4 sm:py-8">
            <div className="glass-modal flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden sm:max-h-[calc(100vh-4rem)]">
              <div className="flex items-center justify-between border-b border-white/50 px-6 py-4">
                <h3 className="text-lg font-semibold text-slate-900">
                  {modalState.mode === "create" ? "Add roster member" : "Edit roster member"}
                </h3>
                <button
                  type="button"
                  onClick={() => setModalState(null)}
                  className="btn-ghost rounded-xl px-2 py-1 text-slate-500"
                >
                  ✕
                </button>
              </div>

              <form action={saveRosterMember} className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <input type="hidden" name="clubRosterYearId" value={rosterYearId} />
              {managedClubId ? <input type="hidden" name="clubId" value={managedClubId} /> : null}
              {modalState.member ? <input type="hidden" name="memberId" value={modalState.member.id} /> : null}

                <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
                  <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1 text-sm font-medium text-slate-700">
                  First Name
                  <input
                    name="firstName"
                    required
                    defaultValue={modalState.member?.firstName ?? ""}
                    className="input-glass"
                  />
                </label>

                <label className="space-y-1 text-sm font-medium text-slate-700">
                  Last Name
                  <input
                    name="lastName"
                    required
                    defaultValue={modalState.member?.lastName ?? ""}
                    className="input-glass"
                  />
                </label>

                <label className="space-y-1 text-sm font-medium text-slate-700">
                  Role
                  <select
                    name="memberRole"
                    required
                    defaultValue={modalState.member?.memberRole ?? MemberRole.PATHFINDER}
                    className="select-glass"
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
                    className="input-glass"
                  />
                </label>

                <label className="space-y-1 text-sm font-medium text-slate-700">
                  Gender
                  <select
                    name="gender"
                    defaultValue={modalState.member?.gender ?? ""}
                    className="select-glass"
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
                    className="input-glass"
                  />
                </label>

                <label className="space-y-1 text-sm font-medium text-slate-700">
                  Background Check Date
                  <input
                    type="date"
                    name="backgroundCheckDate"
                    defaultValue={toDateInputValue(modalState.member?.backgroundCheckDate ?? null)}
                    className="input-glass"
                  />
                  <p className="text-xs font-normal text-slate-500">Required for staff, directors, and counselors.</p>
                </label>

                <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2">
                  Medical Flags
                  <input
                    name="medicalFlags"
                    defaultValue={modalState.member?.medicalFlags ?? ""}
                    className="input-glass"
                  />
                </label>

                <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2">
                  Dietary Restrictions
                  <input
                    name="dietaryRestrictions"
                    defaultValue={modalState.member?.dietaryRestrictions ?? ""}
                    className="input-glass"
                  />
                </label>

                <label className="space-y-1 text-sm font-medium text-slate-700">
                  Emergency Contact Name
                  <input
                    name="emergencyContactName"
                    defaultValue={modalState.member?.emergencyContactName ?? ""}
                    className="input-glass"
                  />
                </label>

                <label className="space-y-1 text-sm font-medium text-slate-700">
                  Emergency Contact Phone
                  <input
                    name="emergencyContactPhone"
                    defaultValue={modalState.member?.emergencyContactPhone ?? ""}
                    className="input-glass"
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

              <section className="glass-subsection space-y-4">
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
                      className="input-glass"
                    />
                  </label>

                  <label className="space-y-1 text-sm font-medium text-slate-700">
                    Insurance Policy Number
                    <input
                      name="insurancePolicyNumber"
                      defaultValue={modalState.member?.insurancePolicyNumber ?? ""}
                      className="input-glass"
                    />
                  </label>

                  <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2">
                    Last Tetanus Date
                    <input
                      type="date"
                      name="lastTetanusDate"
                      defaultValue={toDateInputValue(modalState.member?.lastTetanusDate ?? null)}
                      className="input-glass"
                    />
                  </label>
                </div>

                <div className="alert-warning space-y-3">
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
                </div>

                <div className="flex justify-end gap-2 border-t border-white/50 px-6 py-4">
                  <button
                    type="button"
                    onClick={() => setModalState(null)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                  >
                    {modalState.mode === "create" ? "Create Member" : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
