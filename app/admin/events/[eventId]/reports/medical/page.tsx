import Link from "next/link";
import { notFound } from "next/navigation";

import { getMedicalManifest, type MedicalManifestRow } from "../../../../../actions/medical-report-actions";
import { PrintManifestButton } from "./_components/print-manifest-button";

function formatDateRange(startsAt: Date, endsAt: Date) {
  return `${startsAt.toLocaleDateString()} - ${endsAt.toLocaleDateString()}`;
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
  getDetail: (row: MedicalManifestRow) => string;
};

function ManifestTable({ title, emptyMessage, rows, detailHeader, getDetail }: ManifestTableProps) {
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
                <th className="px-4 py-3">Attendee Name</th>
                <th className="px-4 py-3">Age</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Club Name</th>
                <th className="px-4 py-3">Emergency Contact Info</th>
                <th className="px-4 py-3">{detailHeader}</th>
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

      <header
        data-hide-on-print="true"
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:hidden"
      >
        <p className="text-sm font-medium text-slate-500">Event Reports</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Medical & Dietary Master Manifest</h1>
        <p className="mt-1 text-sm text-slate-600">
          Master event-wide manifest for kitchen and medical staff, including emergency contact details.
        </p>

        <dl className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
          <div>
            <dt className="font-semibold text-slate-900">Event</dt>
            <dd>{report.event.name}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-900">Event Dates</dt>
            <dd>{formatDateRange(report.event.startsAt, report.event.endsAt)}</dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <PrintManifestButton />
          <Link
            href={`/admin/events/${eventId}`}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700"
          >
            Back to Event
          </Link>
        </div>
      </header>

      <ManifestTable
        title="Dietary Restrictions Manifest"
        emptyMessage="No dietary restrictions were reported for submitted or approved registrations."
        rows={report.dietaryRows}
        detailHeader="Dietary Restriction"
        getDetail={(row) => row.dietaryRestrictions ?? ""}
      />

      <ManifestTable
        title="Medical Flags Manifest"
        emptyMessage="No medical flags were reported for submitted or approved registrations."
        rows={report.medicalRows}
        detailHeader="Medical Flag"
        getDetail={(row) => row.medicalFlags ?? ""}
      />
    </section>
  );
}
