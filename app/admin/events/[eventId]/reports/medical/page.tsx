import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getMedicalManifest, type MedicalManifestRow } from "../../../../../actions/medical-report-actions";
import { AdminPageHeader } from "../../../../_components/admin-page-header";
import { PrintManifestButton } from "./_components/print-manifest-button";
import { DownloadManifestCsvButton } from "./_components/download-manifest-csv-button";

function formatDateRange(startsAt: Date, endsAt: Date, locale: string) {
  return `${startsAt.toLocaleDateString(locale)} - ${endsAt.toLocaleDateString(locale)}`;
}

type MedicalManifestPageProps = {
  params: Promise<{
    eventId: string;
  }>;
};

type ManifestTableProps = {
  title: string;
  emptyMessage: string;
  rows: MedicalManifestRow[];
  detailHeader: string;
  attendeeHeader: string;
  ageHeader: string;
  roleHeader: string;
  clubHeader: string;
  emergencyHeader: string;
  consentHeader: string;
  locale: string;
  getDetail: (row: MedicalManifestRow) => string;
};

function formatConsentTimestamps(row: MedicalManifestRow, locale: string) {
  const parts: string[] = [];

  if (row.photoReleaseConsentAt) {
    parts.push(`Photo: ${row.photoReleaseConsentAt.toLocaleDateString(locale)}`);
  }

  if (row.medicalTreatmentConsentAt) {
    parts.push(`Medical: ${row.medicalTreatmentConsentAt.toLocaleDateString(locale)}`);
  }

  if (row.membershipAgreementConsentAt) {
    parts.push(`Membership: ${row.membershipAgreementConsentAt.toLocaleDateString(locale)}`);
  }

  return parts.length > 0 ? parts.join(" | ") : "Not recorded";
}

function ManifestTable({
  title,
  emptyMessage,
  rows,
  detailHeader,
  attendeeHeader,
  ageHeader,
  roleHeader,
  clubHeader,
  emergencyHeader,
  consentHeader,
  locale,
  getDetail,
}: ManifestTableProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:rounded-none print:border-none print:p-0 print:shadow-none">
      <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>

      {rows.length === 0 ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{emptyMessage}</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 print:bg-white">
              <tr>
                <th className="px-4 py-3">{attendeeHeader}</th>
                <th className="px-4 py-3">{ageHeader}</th>
                <th className="px-4 py-3">{roleHeader}</th>
                <th className="px-4 py-3">{clubHeader}</th>
                <th className="px-4 py-3">{emergencyHeader}</th>
                <th className="px-4 py-3">{detailHeader}</th>
                <th className="px-4 py-3">{consentHeader}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={`${title}-${row.attendeeId}`} className="align-top">
                  <td className="px-4 py-3 font-medium text-slate-900">{row.attendeeName}</td>
                  <td className="px-4 py-3 text-slate-700">{row.age}</td>
                  <td className="px-4 py-3 text-slate-700">{row.role}</td>
                  <td className="px-4 py-3 text-slate-700">{row.clubName}</td>
                  <td className="px-4 py-3 text-slate-700">{row.emergencyContactInfo}</td>
                  <td className="px-4 py-3 text-slate-900">{getDetail(row)}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{formatConsentTimestamps(row, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

export default async function MedicalManifestPage({ params }: MedicalManifestPageProps) {
  const t = await getTranslations("Admin");
  const locale = await getLocale();
  const { eventId } = await params;
  const report = await getMedicalManifest(eventId);

  if (!report) {
    notFound();
  }

  return (
    <section className="space-y-6">
      <style>{`
        @media print {
          nav, aside, footer, [data-hide-on-print="true"] {
            display: none !important;
          }

          main {
            margin: 0 !important;
            padding: 0 !important;
          }

          body {
            background: #fff !important;
          }

          table {
            break-inside: auto;
          }

          tr, td, th {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div data-hide-on-print="true" className="print:hidden">
        <AdminPageHeader
          eyebrow={t("breadcrumbs.medicalManifest")}
          breadcrumbs={[
            { label: t("breadcrumbs.admin"), href: "/admin/dashboard" },
            { label: t("breadcrumbs.events"), href: "/admin/events" },
            { label: report.event.name, href: `/admin/events/${eventId}` },
            { label: t("breadcrumbs.medicalManifest") },
          ]}
          title={t("breadcrumbs.medicalManifest")}
          description="Master event-wide manifest for kitchen and medical staff, including emergency contact details."
          primaryAction={
            <div className="flex gap-2">
              <DownloadManifestCsvButton report={report} locale={locale} />
              <PrintManifestButton />
            </div>
          }
          secondaryActions={
            <Link href={`/admin/events/${eventId}`} className="btn-secondary">
              {t("actions.backToEvent")}
            </Link>
          }
          details={
            <>
              <div>
                <dt className="font-semibold text-slate-900">{t("pages.events.columns.event")}</dt>
                <dd>{report.event.name}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-900">{t("pages.events.columns.dates")}</dt>
                <dd>{formatDateRange(report.event.startsAt, report.event.endsAt, locale)}</dd>
              </div>
            </>
          }
        />
      </div>

      <ManifestTable
        title={t("pages.medical.dietaryTitle")}
        emptyMessage={t("pages.medical.dietaryEmpty")}
        rows={report.dietaryRows}
        detailHeader={t("pages.medical.dietaryDetail")}
        attendeeHeader={t("pages.medical.table.attendee")}
        ageHeader={t("pages.medical.table.age")}
        roleHeader={t("pages.medical.table.role")}
        clubHeader={t("pages.medical.table.club")}
        emergencyHeader={t("pages.medical.table.emergency")}
        consentHeader="Consent Timestamps"
        locale={locale}
        getDetail={(row) => row.dietaryRestrictions ?? ""}
      />

      <ManifestTable
        title={t("pages.medical.medicalTitle")}
        emptyMessage={t("pages.medical.medicalEmpty")}
        rows={report.medicalRows}
        detailHeader={t("pages.medical.medicalDetail")}
        attendeeHeader={t("pages.medical.table.attendee")}
        ageHeader={t("pages.medical.table.age")}
        roleHeader={t("pages.medical.table.role")}
        clubHeader={t("pages.medical.table.club")}
        emergencyHeader={t("pages.medical.table.emergency")}
        consentHeader="Consent Timestamps"
        locale={locale}
        getDetail={(row) => row.medicalFlags ?? ""}
      />
    </section>
  );
}
