 "use client";

import { useTranslations } from "next-intl";
import type { AvReportRow, DutyReportRow, SpiritualReportRow } from "../../../../../../actions/report-actions";

type ExportButtonProps = {
  href: string;
  fileName: string;
  label: string;
};

export function ExportCsvButton({ href, fileName, label }: ExportButtonProps) {
  return (
    <a
      href={href}
      download={fileName}
      className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
    >
      {label}
    </a>
  );
}

type SpiritualReportTableProps = {
  rows: SpiritualReportRow[];
};

export function SpiritualReportTable({ rows }: SpiritualReportTableProps) {
  const t = useTranslations("Admin");
  if (rows.length === 0) {
    return <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{t("pages.operationalReports.empty.spiritual")}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
          <tr>
            <th scope="col" className="px-4 py-3">{t("pages.operationalReports.table.club")}</th>
            <th scope="col" className="px-4 py-3">{t("pages.operationalReports.table.clubCode")}</th>
            <th scope="col" className="px-4 py-3">{t("pages.operationalReports.table.formField")}</th>
            <th scope="col" className="px-4 py-3">{t("pages.operationalReports.table.nameResponse")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, index) => (
            <tr key={`${row.clubCode}-${row.sourceKey}-${row.response}-${index}`}>
              <td className="px-4 py-3 text-slate-900">{row.clubName}</td>
              <td className="px-4 py-3 text-slate-700">{row.clubCode}</td>
              <td className="px-4 py-3 text-slate-700">{row.sourceLabel}</td>
              <td className="px-4 py-3 text-slate-900">{row.response}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type DutyReportTableProps = {
  rows: DutyReportRow[];
};

export function DutyReportTable({ rows }: DutyReportTableProps) {
  const t = useTranslations("Admin");
  if (rows.length === 0) {
    return <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{t("pages.operationalReports.empty.duty")}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
          <tr>
            <th scope="col" className="px-4 py-3">{t("pages.operationalReports.table.dutyActivity")}</th>
            <th scope="col" className="px-4 py-3">{t("pages.operationalReports.table.assignedClubs")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.assignment}>
              <td className="px-4 py-3 align-top font-semibold text-slate-900">{row.assignment}</td>
              <td className="px-4 py-3">
                <ul className="space-y-1">
                  {row.clubs.map((club) => (
                    <li key={`${row.assignment}-${club.clubCode}`} className="text-slate-700">
                      {club.clubName} <span className="text-xs text-slate-500">({club.clubCode})</span>
                    </li>
                  ))}
                </ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type AvReportTableProps = {
  rows: AvReportRow[];
};

export function AvReportTable({ rows }: AvReportTableProps) {
  const t = useTranslations("Admin");
  if (rows.length === 0) {
    return <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{t("pages.operationalReports.empty.av")}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
          <tr>
            <th scope="col" className="px-4 py-3">{t("pages.operationalReports.table.club")}</th>
            <th scope="col" className="px-4 py-3">{t("pages.operationalReports.table.clubCode")}</th>
            <th scope="col" className="px-4 py-3">{t("pages.operationalReports.table.requestedItems")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={`${row.clubCode}-${row.requestedItems}`}>
              <td className="px-4 py-3 text-slate-900">{row.clubName}</td>
              <td className="px-4 py-3 text-slate-700">{row.clubCode}</td>
              <td className="px-4 py-3 text-slate-900">{row.requestedItems}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
