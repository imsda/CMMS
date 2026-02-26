import Link from "next/link";
import { notFound } from "next/navigation";

import { getEventPatchOrderCsv, getEventPatchOrderReport } from "../../../../../actions/admin-actions";

function formatDateRange(startsAt: Date, endsAt: Date) {
  return `${startsAt.toLocaleDateString()} - ${endsAt.toLocaleDateString()}`;
}

type EventPatchOrderReportPageProps = {
  params: Promise<{
    eventId: string;
  }>;
};

export default async function EventPatchOrderReportPage({ params }: EventPatchOrderReportPageProps) {
  const { eventId } = await params;

  const report = await getEventPatchOrderReport(eventId);

  if (!report) {
    notFound();
  }

  const csvData = await getEventPatchOrderCsv(eventId);
  const csvHref = `data:text/csv;charset=utf-8,${encodeURIComponent(csvData.content)}`;

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Conference Reports</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Patch Order Report</h1>
        <p className="mt-1 text-sm text-slate-600">
          Aggregated honor completion totals during this event for supplier patch ordering.
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

        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href={csvHref}
            download={csvData.fileName}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Export Patch Order CSV
          </a>
          <Link
            href={`/admin/events/${eventId}`}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700"
          >
            Back to Event
          </Link>
        </div>
      </header>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Honor Patch Totals</h2>
        <p className="mt-1 text-sm text-slate-600">
          One row per honor code with total completed count during the event date range.
        </p>

        {report.rows.length === 0 ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            No honor completions were recorded during this event.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3">Honor Name</th>
                  <th className="px-4 py-3">Honor Code</th>
                  <th className="px-4 py-3">Total Count Needed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.rows.map((row) => (
                  <tr key={row.honorCode} className="align-top">
                    <td className="px-4 py-3 text-slate-900">{row.honorName}</td>
                    <td className="px-4 py-3 text-slate-700">{row.honorCode}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{row.totalCountNeeded}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}
