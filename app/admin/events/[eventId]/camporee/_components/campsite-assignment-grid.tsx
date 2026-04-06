"use client";

import { useTransition } from "react";

import { assignCampsite } from "../../../../../actions/camporee-actions";
import { buildCsvHref } from "../../../../../../lib/csv";

export type CampsiteAssignmentRow = {
  registrationId: string;
  clubName: string;
  campsiteType: string | null;
  squareFootageNeeded: number | null;
  tentSummary: string | null;
  campsiteAssignment: string | null;
};

type Props = {
  rows: CampsiteAssignmentRow[];
  fileBase: string;
};

export function CampsiteAssignmentGrid({ rows, fileBase }: Props) {
  const [, startTransition] = useTransition();

  function handleBlur(registrationId: string, value: string) {
    startTransition(async () => {
      await assignCampsite(registrationId, value);
    });
  }

  const csvHref = buildCsvHref([
    ["Club Name", "Type Requested", "Sq Ft", "Tent Summary", "Assignment"],
    ...rows.map((row) => [
      row.clubName,
      row.campsiteType ?? "",
      row.squareFootageNeeded ?? 0,
      row.tentSummary ?? "",
      row.campsiteAssignment ?? "",
    ]),
  ]);

  return (
    <>
      <div className="flex justify-end">
        <a href={csvHref} download={`${fileBase}-campsite-plan.csv`} className="btn-secondary">
          Export Campsite Plan CSV
        </a>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <th scope="col" className="px-4 py-3">Club Name</th>
              <th scope="col" className="px-4 py-3">Type Requested</th>
              <th scope="col" className="px-4 py-3">Sq Ft</th>
              <th scope="col" className="px-4 py-3">Tent Summary</th>
              <th scope="col" className="px-4 py-3">Assignment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.registrationId}>
                <td className="px-4 py-3 text-slate-900">{row.clubName}</td>
                <td className="px-4 py-3 text-slate-700">{row.campsiteType ?? "—"}</td>
                <td className="px-4 py-3 text-slate-700">{row.squareFootageNeeded ?? "—"}</td>
                <td className="px-4 py-3 text-slate-700">{row.tentSummary ?? "—"}</td>
                <td className="px-4 py-2">
                  <input
                    type="text"
                    defaultValue={row.campsiteAssignment ?? ""}
                    onBlur={(e) => handleBlur(row.registrationId, e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                    placeholder="e.g. A-12"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
