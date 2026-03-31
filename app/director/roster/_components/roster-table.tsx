"use client";

import { Gender, MemberRole } from "@prisma/client";
import { useMemo, useState } from "react";
import { useFormState } from "react-dom";
import { useTranslations } from "next-intl";

import { saveRosterMember, importRosterMembers, type ImportRosterResult } from "../../../actions/roster-actions";

// ---------------------------------------------------------------------------
// CSV template column headers (order matters — matches the import parser)
// Required: firstName, lastName, memberRole, dateOfBirth
// Optional: gender, ageAtStart, emergencyContactName, emergencyContactPhone,
//           medicalFlags, dietaryRestrictions, isFirstTime, isMedicalPersonnel, masterGuide
// memberRole values: PATHFINDER | ADVENTURER | TLT | STAFF | CHILD | DIRECTOR | COUNSELOR
// gender values: MALE | FEMALE | NON_BINARY | PREFER_NOT_TO_SAY
// dateOfBirth format: YYYY-MM-DD   Boolean columns: true | false
// ---------------------------------------------------------------------------
const CSV_IMPORT_HEADERS = [
  "firstName",
  "lastName",
  "memberRole",
  "dateOfBirth",
  "gender",
  "ageAtStart",
  "emergencyContactName",
  "emergencyContactPhone",
  "medicalFlags",
  "dietaryRestrictions",
  "isFirstTime",
  "isMedicalPersonnel",
  "masterGuide",
] as const;

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
  swimTestCleared: boolean;
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

function downloadCsvTemplate() {
  const headerRow = CSV_IMPORT_HEADERS.join(",");
  const exampleRow = "Jane,Doe,PATHFINDER,2012-05-14,FEMALE,12,Parent Name,555-0100,,,false,false,false";
  const csv = `${headerRow}\n${exampleRow}\n`;
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "roster-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function RosterTable({ rosterYearId, managedClubId, members }: RosterTableProps) {
  const t = useTranslations("Director");
  const [modalState, setModalState] = useState<ModalState | null>(null);
  const [showImportForm, setShowImportForm] = useState(false);
  const [importResult, importAction] = useFormState<ImportRosterResult | null, FormData>(importRosterMembers, null);

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
          <h2 className="section-title">{t("rosterTable.title")}</h2>
          <p className="section-copy">{t("rosterTable.description")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={downloadCsvTemplate}
            className="btn-secondary"
          >
            {t("rosterTable.downloadTemplate")}
          </button>
          <button
            type="button"
            onClick={() => setShowImportForm((v) => !v)}
            className="btn-secondary"
          >
            {t("rosterTable.importCsv")}
          </button>
          <button
            type="button"
            onClick={() => setModalState({ mode: "create", member: null })}
            className="btn-primary"
          >
            {t("rosterTable.addMember")}
          </button>
        </div>
      </div>

      {showImportForm ? (
        <div className="glass-panel space-y-3">
          <h3 className="text-base font-semibold text-slate-900">{t("rosterTable.csvImport.title")}</h3>
          <p className="text-sm text-slate-600">{t("rosterTable.csvImport.description")}</p>
          <form action={importAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="clubRosterYearId" value={rosterYearId} />
            {managedClubId ? <input type="hidden" name="clubId" value={managedClubId} /> : null}
            <label className="flex-1 space-y-1 text-sm font-medium text-slate-700">
              <span>{t("rosterTable.csvImport.fileLabel")}</span>
              <input
                type="file"
                name="csvFile"
                accept=".csv,text/csv"
                required
                className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
              />
            </label>
            <button type="submit" className="btn-primary">
              {t("rosterTable.csvImport.submit")}
            </button>
          </form>

          {importResult !== null ? (
            <div
              className={[
                "rounded-lg border px-4 py-3 text-sm",
                importResult.errors.length > 0 && importResult.imported === 0
                  ? "border-rose-200 bg-rose-50 text-rose-800"
                  : importResult.errors.length > 0
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-emerald-200 bg-emerald-50 text-emerald-800",
              ].join(" ")}
            >
              <p className="font-semibold">
                {t("rosterTable.csvImport.result", {
                  imported: importResult.imported,
                  skipped: importResult.skipped,
                })}
              </p>
              {importResult.errors.length > 0 ? (
                <ul className="mt-2 list-inside list-disc space-y-1 text-xs">
                  {importResult.errors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="glass-table table-shell overflow-hidden">
        <table>
          <thead>
            <tr>
              {[
                t("rosterTable.headers.name"),
                t("rosterTable.headers.tags"),
                t("rosterTable.headers.role"),
                t("rosterTable.headers.backgroundCheck"),
                t("rosterTable.headers.consents"),
                t("rosterTable.headers.age"),
                t("rosterTable.headers.gender"),
                t("rosterTable.headers.medical"),
                t("rosterTable.headers.dietary"),
                t("rosterTable.headers.masterGuide"),
                t("rosterTable.headers.swimTest"),
                t("rosterTable.headers.actions"),
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
                <td colSpan={12} className="px-4 py-10 text-center text-sm text-slate-500">
                  {t("rosterTable.empty")}
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
                        {member.isMedicalPersonnel ? <Badge label={t("rosterTable.badges.medical")} tone="good" /> : null}
                        {member.isFirstTime ? <Badge label={t("rosterTable.badges.firstYear")} tone="warn" /> : null}
                        {!member.isMedicalPersonnel && !member.isFirstTime ? <Badge label="—" tone="neutral" /> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{member.memberRole.replaceAll("_", " ")}</td>
                    <td className="px-4 py-3">
                      {!requiresCheck ? (
                        <Badge label={t("rosterTable.badges.notRequired")} tone="neutral" />
                      ) : missingClearance ? (
                        <Badge label={t("rosterTable.badges.missingClearance")} tone="danger" />
                      ) : (
                        <Badge
                          label={
                            member.backgroundCheckCleared
                              ? t("rosterTable.badges.cleared", { date: formatDateLabel(member.backgroundCheckDate) })
                              : t("rosterTable.badges.dateLogged", { date: formatDateLabel(member.backgroundCheckDate) })
                          }
                          tone="good"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {missingConsent ? (
                        <span className="status-chip-warning" title={t("rosterTable.missingConsentsTitle")}>
                          {t("rosterTable.badges.missing")}
                        </span>
                      ) : (
                        <Badge label={t("rosterTable.badges.complete")} tone="good" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{member.ageAtStart ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {member.gender ? member.gender.replaceAll("_", " ") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {member.medicalFlags ? <Badge label={t("rosterTable.badges.flagged")} tone="warn" /> : <Badge label={t("common.none")} tone="neutral" />}
                    </td>
                    <td className="px-4 py-3">
                      {member.dietaryRestrictions ? <Badge label={t("common.yes")} tone="warn" /> : <Badge label={t("common.none")} tone="neutral" />}
                    </td>
                    <td className="px-4 py-3">
                      {member.masterGuide ? <Badge label={t("rosterTable.badges.certified")} tone="good" /> : <Badge label={t("common.no")} tone="neutral" />}
                    </td>
                    <td className="px-4 py-3">
                      {member.swimTestCleared ? <Badge label={t("rosterTable.badges.cleared2")} tone="good" /> : <Badge label={t("rosterTable.badges.notCleared")} tone="neutral" />}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setModalState({ mode: "edit", member })}
                        className="btn-secondary px-3 py-1.5 text-xs"
                      >
                        {t("rosterTable.edit")}
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
                  {modalState.mode === "create" ? t("rosterTable.modal.addTitle") : t("rosterTable.modal.editTitle")}
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
                  {t("rosterTable.form.firstName")}
                  <input
                    name="firstName"
                    required
                    defaultValue={modalState.member?.firstName ?? ""}
                    className="input-glass"
                  />
                </label>

                <label className="space-y-1 text-sm font-medium text-slate-700">
                  {t("rosterTable.form.lastName")}
                  <input
                    name="lastName"
                    required
                    defaultValue={modalState.member?.lastName ?? ""}
                    className="input-glass"
                  />
                </label>

                <label className="space-y-1 text-sm font-medium text-slate-700">
                  {t("rosterTable.form.role")}
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
                  {t("rosterTable.form.age")}
                  <input
                    type="number"
                    min={0}
                    name="ageAtStart"
                    defaultValue={modalState.member?.ageAtStart ?? ""}
                    className="input-glass"
                  />
                </label>

                <label className="space-y-1 text-sm font-medium text-slate-700">
                  {t("rosterTable.form.gender")}
                  <select
                    name="gender"
                    defaultValue={modalState.member?.gender ?? ""}
                    className="select-glass"
                  >
                    <option value="">{t("rosterTable.form.preferNotToSay")}</option>
                    {genderOptions.map((gender) => (
                      <option key={gender} value={gender}>
                        {gender.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-sm font-medium text-slate-700">
                  {t("rosterTable.form.dateOfBirth")}
                  <input
                    type="date"
                    name="dateOfBirth"
                    defaultValue={toDateInputValue(modalState.member?.dateOfBirth ?? null)}
                    className="input-glass"
                  />
                </label>

                <label className="space-y-1 text-sm font-medium text-slate-700">
                  {t("rosterTable.form.backgroundCheckDate")}
                  <input
                    type="date"
                    name="backgroundCheckDate"
                    defaultValue={toDateInputValue(modalState.member?.backgroundCheckDate ?? null)}
                    className="input-glass"
                  />
                  <p className="text-xs font-normal text-slate-500">{t("rosterTable.form.backgroundCheckHelp")}</p>
                </label>

                <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2">
                  {t("rosterTable.form.medicalFlags")}
                  <input
                    name="medicalFlags"
                    defaultValue={modalState.member?.medicalFlags ?? ""}
                    className="input-glass"
                  />
                </label>

                <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2">
                  {t("rosterTable.form.dietaryRestrictions")}
                  <input
                    name="dietaryRestrictions"
                    defaultValue={modalState.member?.dietaryRestrictions ?? ""}
                    className="input-glass"
                  />
                </label>

                <label className="space-y-1 text-sm font-medium text-slate-700">
                  {t("rosterTable.form.emergencyContactName")}
                  <input
                    name="emergencyContactName"
                    defaultValue={modalState.member?.emergencyContactName ?? ""}
                    className="input-glass"
                  />
                </label>

                <label className="space-y-1 text-sm font-medium text-slate-700">
                  {t("rosterTable.form.emergencyContactPhone")}
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
                  {t("rosterTable.form.firstTimeMember")}
                </label>

                <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    name="isMedicalPersonnel"
                    defaultChecked={modalState.member?.isMedicalPersonnel ?? false}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  {t("rosterTable.form.medicalPersonnel")}
                </label>

                <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    name="masterGuide"
                    defaultChecked={modalState.member?.masterGuide ?? false}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  {t("rosterTable.form.masterGuide")}
                </label>

                <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    name="isActive"
                    defaultChecked={modalState.member?.isActive ?? true}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  {t("rosterTable.form.activeMember")}
                </label>

                <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    name="swimTestCleared"
                    defaultChecked={modalState.member?.swimTestCleared ?? false}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  {t("rosterTable.form.swimTestCleared")}
                </label>
              </div>

              <section className="glass-subsection space-y-4">
                <div>
                  <h4 className="text-base font-semibold text-slate-900">{t("rosterTable.form.agreementsTitle")}</h4>
                  <p className="text-sm text-slate-600">
                    {t("rosterTable.form.agreementsDescription")}
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-1 text-sm font-medium text-slate-700">
                    {t("rosterTable.form.insuranceCompany")}
                    <input
                      name="insuranceCompany"
                      defaultValue={modalState.member?.insuranceCompany ?? ""}
                      className="input-glass"
                    />
                  </label>

                  <label className="space-y-1 text-sm font-medium text-slate-700">
                    {t("rosterTable.form.insurancePolicyNumber")}
                    <input
                      name="insurancePolicyNumber"
                      defaultValue={modalState.member?.insurancePolicyNumber ?? ""}
                      className="input-glass"
                    />
                  </label>

                  <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2">
                    {t("rosterTable.form.lastTetanusDate")}
                    <input
                      type="date"
                      name="lastTetanusDate"
                      defaultValue={toDateInputValue(modalState.member?.lastTetanusDate ?? null)}
                      className="input-glass"
                    />
                  </label>
                </div>

                <div className="alert-warning space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">{t("rosterTable.form.requiredConsents")}</p>

                  <label className="flex items-start gap-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      name="photoReleaseConsent"
                      required
                      defaultChecked={modalState.member?.photoReleaseConsent ?? false}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>
                      <strong>{t("rosterTable.form.photoReleaseLabel")}</strong> {t("rosterTable.form.photoReleaseText")}
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
                      <strong>{t("rosterTable.form.medicalConsentLabel")}</strong> {t("rosterTable.form.medicalConsentText")}
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
                      <strong>{t("rosterTable.form.membershipAgreementLabel")}</strong> {t("rosterTable.form.membershipAgreementText")}
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
                    {t("rosterTable.form.cancel")}
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                  >
                    {modalState.mode === "create" ? t("rosterTable.form.createMember") : t("rosterTable.form.saveChanges")}
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
