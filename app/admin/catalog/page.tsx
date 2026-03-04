import { ClassType, MemberRole, RequirementType } from "@prisma/client";

import {
  createMasterCatalogItem,
  getMasterCatalogData,
  updateMasterCatalogItem,
} from "../../actions/admin-actions";

function renderRequirementSummary(requirement: {
  requirementType: RequirementType;
  minAge: number | null;
  maxAge: number | null;
  requiredMemberRole: MemberRole | null;
  requiredHonorCode: string | null;
  requiredMasterGuide: boolean | null;
}) {
  const parts: string[] = [`Type: ${requirement.requirementType}`];

  if (requirement.minAge !== null) {
    parts.push(`Min Age: ${requirement.minAge}`);
  }

  if (requirement.maxAge !== null) {
    parts.push(`Max Age: ${requirement.maxAge}`);
  }

  if (requirement.requiredMemberRole) {
    parts.push(`Role: ${requirement.requiredMemberRole}`);
  }

  if (requirement.requiredHonorCode) {
    parts.push(`Honor: ${requirement.requiredHonorCode}`);
  }

  if (requirement.requiredMasterGuide !== null) {
    parts.push(`Master Guide: ${requirement.requiredMasterGuide ? "Required" : "Not Required"}`);
  }

  return parts.join(" • ");
}

export default async function AdminCatalogPage() {
  const catalog = await getMasterCatalogData();

  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm font-medium text-slate-500">Super Admin</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Master Class/Honor Catalog</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage conference-wide honors, workshops, and prerequisite requirements.
        </p>
      </header>

      <details className="group rounded-2xl border border-indigo-200 bg-indigo-50 p-6 shadow-sm" open>
        <summary className="cursor-pointer list-none text-lg font-semibold text-indigo-900">
          Add New Honor / Catalog Item
        </summary>
        <p className="mt-2 text-sm text-indigo-800">
          Example: <strong>Camping Skills I</strong> with prerequisites like Min Age: 10 and Role:
          Pathfinder.
        </p>

        <form action={createMasterCatalogItem} className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm text-slate-700">
              <span>Title</span>
              <input
                name="title"
                required
                placeholder="Camping Skills I"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              />
            </label>

            <label className="space-y-1 text-sm text-slate-700">
              <span>Code</span>
              <input
                name="code"
                required
                placeholder="HON-CAMP-1"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              />
            </label>

            <label className="space-y-1 text-sm text-slate-700">
              <span>Class Type</span>
              <select
                name="classType"
                required
                defaultValue={ClassType.HONOR}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              >
                {Object.values(ClassType).map((classType) => (
                  <option key={classType} value={classType}>
                    {classType}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm text-slate-700">
              <span>Active</span>
              <div className="flex h-10 items-center rounded-lg border border-slate-300 bg-white px-3">
                <input id="create-active" name="active" type="checkbox" defaultChecked className="h-4 w-4" />
                <label htmlFor="create-active" className="ml-2 text-sm text-slate-700">
                  Catalog item is active
                </label>
              </div>
            </label>

            <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
              <span>Description</span>
              <textarea
                name="description"
                rows={3}
                placeholder="Foundational camping honor focused on setup, safety, and field skills."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              />
            </label>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">Prerequisite (Optional)</h2>
            <div className="mt-3 grid gap-4 md:grid-cols-3">
              <label className="space-y-1 text-sm text-slate-700">
                <span>Requirement Type</span>
                <select
                  name="requirementType"
                  defaultValue={RequirementType.MIN_AGE}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                >
                  <option value="NONE">None</option>
                  {Object.values(RequirementType).map((requirementType) => (
                    <option key={requirementType} value={requirementType}>
                      {requirementType}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-sm text-slate-700">
                <span>Minimum Age</span>
                <input name="minAge" type="number" min={0} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>

              <label className="space-y-1 text-sm text-slate-700">
                <span>Maximum Age</span>
                <input name="maxAge" type="number" min={0} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>

              <label className="space-y-1 text-sm text-slate-700">
                <span>Required Role</span>
                <select name="requiredMemberRole" defaultValue="NONE" className="w-full rounded-lg border border-slate-300 px-3 py-2">
                  <option value="NONE">None</option>
                  {Object.values(MemberRole).map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-sm text-slate-700">
                <span>Required Honor Code</span>
                <input
                  name="requiredHonorCode"
                  placeholder="HON-CAMP-INTRO"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>

              <label className="space-y-1 text-sm text-slate-700">
                <span>Master Guide Requirement</span>
                <select name="requiredMasterGuide" defaultValue="NONE" className="w-full rounded-lg border border-slate-300 px-3 py-2">
                  <option value="NONE">Not specified</option>
                  <option value="true">Must be Master Guide</option>
                  <option value="false">Must not require Master Guide</option>
                </select>
              </label>
            </div>
          </div>

          <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
            Add Catalog Item
          </button>
        </form>
      </details>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Catalog Table</h2>
        {catalog.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No class catalog items found.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {catalog.map((item) => {
              const requirement = item.requirements[0] ?? null;

              return (
                <form
                  key={item.id}
                  action={updateMasterCatalogItem}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <input type="hidden" name="classCatalogId" value={item.id} />
                  <div className="grid gap-3 md:grid-cols-4">
                    <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Title
                      <input
                        name="title"
                        defaultValue={item.title}
                        required
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900"
                      />
                    </label>

                    <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Code
                      <input
                        name="code"
                        defaultValue={item.code}
                        required
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900"
                      />
                    </label>

                    <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Type
                      <select
                        name="classType"
                        defaultValue={item.classType}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900"
                      >
                        {Object.values(ClassType).map((classType) => (
                          <option key={classType} value={classType}>
                            {classType}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Active
                      <select
                        name="active"
                        defaultValue={String(item.active)}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900"
                      >
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                    </label>

                    <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-600 md:col-span-4">
                      Description
                      <textarea
                        name="description"
                        defaultValue={item.description ?? ""}
                        rows={2}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900"
                      />
                    </label>

                    <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Requirement Type
                      <select
                        name="requirementType"
                        defaultValue={requirement?.requirementType ?? "NONE"}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900"
                      >
                        <option value="NONE">None</option>
                        {Object.values(RequirementType).map((requirementType) => (
                          <option key={requirementType} value={requirementType}>
                            {requirementType}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Min Age
                      <input
                        name="minAge"
                        type="number"
                        defaultValue={requirement?.minAge ?? ""}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900"
                      />
                    </label>

                    <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Max Age
                      <input
                        name="maxAge"
                        type="number"
                        defaultValue={requirement?.maxAge ?? ""}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900"
                      />
                    </label>

                    <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Required Role
                      <select
                        name="requiredMemberRole"
                        defaultValue={requirement?.requiredMemberRole ?? "NONE"}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900"
                      >
                        <option value="NONE">None</option>
                        {Object.values(MemberRole).map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Required Honor Code
                      <input
                        name="requiredHonorCode"
                        defaultValue={requirement?.requiredHonorCode ?? ""}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900"
                      />
                    </label>

                    <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Master Guide
                      <select
                        name="requiredMasterGuide"
                        defaultValue={requirement?.requiredMasterGuide === null ? "NONE" : String(requirement?.requiredMasterGuide)}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900"
                      >
                        <option value="NONE">Not specified</option>
                        <option value="true">Required</option>
                        <option value="false">Not required</option>
                      </select>
                    </label>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-xs text-slate-500">
                      {requirement ? renderRequirementSummary(requirement) : "No prerequisite configured."}
                      {" "}• {item._count.offerings} total offerings
                    </p>
                    <button
                      type="submit"
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              );
            })}
          </div>
        )}
      </article>
    </section>
  );
}
