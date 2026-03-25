"use client";

import { type MedicalManifestData } from "../../../../../../actions/medical-report-actions";

type DownloadManifestCsvButtonProps = {
  report: MedicalManifestData;
  locale: string;
};

function escapeCSVField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

function formatDate(date: Date | null, locale: string): string {
  if (!date) {
    return "";
  }

  return date.toLocaleDateString(locale);
}

function buildCsvRows(report: MedicalManifestData, locale: string): string {
  const headers = [
    "Attendee",
    "Age",
    "Role",
    "Club",
    "Emergency Contact",
    "Medical Flags",
    "Dietary Restrictions",
    "Photo Release Consent At",
    "Medical Treatment Consent At",
    "Membership Agreement Consent At",
  ];

  const allRows = [...report.medicalRows, ...report.dietaryRows].filter(
    (row, idx, arr) => arr.findIndex((r) => r.attendeeId === row.attendeeId) === idx,
  );

  const dataRows = allRows.map((row) =>
    [
      row.attendeeName,
      row.age,
      row.role,
      row.clubName,
      row.emergencyContactInfo,
      row.medicalFlags ?? "",
      row.dietaryRestrictions ?? "",
      formatDate(row.photoReleaseConsentAt, locale),
      formatDate(row.medicalTreatmentConsentAt, locale),
      formatDate(row.membershipAgreementConsentAt, locale),
    ]
      .map(escapeCSVField)
      .join(","),
  );

  return [headers.map(escapeCSVField).join(","), ...dataRows].join("\n");
}

export function DownloadManifestCsvButton({ report, locale }: DownloadManifestCsvButtonProps) {
  function handleDownload() {
    const csv = buildCsvRows(report, locale);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `medical-manifest-${report.event.name.toLowerCase().replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button type="button" onClick={handleDownload} className="btn-secondary">
      Download CSV
    </button>
  );
}
