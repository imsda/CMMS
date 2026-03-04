import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getOperationalAvCsv,
  getOperationalDutyCsv,
  getOperationalReports,
  getOperationalSpiritualCsv,
} from "../../../../../actions/report-actions";
import {
  AvReportTable,
  DutyReportTable,
  ExportCsvButton,
  SpiritualReportTable,
} from "./_components/report-tables";

function formatDateRange(startsAt: Date, endsAt: Date) {
  return `${startsAt.toLocaleDateString()} - ${endsAt.toLocaleDateString()}`;
}

type OperationalReportsPageProps = {
  params: Promise<{
    eventId: string;
  }>;
};

export default async function OperationalReportsPage({ params }: OperationalReportsPageProps) {
  const { eventId } = await params;

  const report = await getOperationalReports(eventId);

  if (!report) {
    notFound();
  }

  const [spiritualCsv, dutyCsv, avCsv] = await Promise.all([
    getOperationalSpiritualCsv(eventId),
    getOperationalDutyCsv(eventId),
    getOperationalAvCsv(eventId),
  ]);

  const spiritualCsvHref = `data:text/csv;charset=utf-8,${encodeURIComponent(spiritualCsv.content)}`;
  const dutyCsvHref = `data:text/csv;charset=utf-8,${encodeURIComponent(dutyCsv.content)}`;
  const avCsvHref = `data:text/csv;charset=utf-8,${encodeURIComponent(avCsv.content)}`;

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Conference Reports</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Operational Reports</h1>
        <p className="mt-1 text-sm text-slate-600">
          Dedicated logistics dashboards for spiritual decisions, duties/activities, and AV equipment requests.
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
          <Link
            href={`/admin/events/${eventId}`}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700"
          >
            Back to Event
          </Link>
        </div>
      </header>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Baptism / Spiritual List</h2>
            <p className="mt-1 text-sm text-slate-600">
              Entries pulled from <span className="font-mono">baptism_names</span> and <span className="font-mono">bible_names</span> across all submitted or approved registrations.
            </p>
          </div>
          <ExportCsvButton href={spiritualCsvHref} fileName={spiritualCsv.fileName} label="Export to CSV" />
        </div>

        <SpiritualReportTable rows={report.spiritualRows} />
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Duty / Activity Roster</h2>
            <p className="mt-1 text-sm text-slate-600">
              Clubs grouped by selections in <span className="font-mono">duty_first</span>, <span className="font-mono">duty_second</span>, and <span className="font-mono">special_activity</span>.
            </p>
          </div>
          <ExportCsvButton href={dutyCsvHref} fileName={dutyCsv.fileName} label="Export to CSV" />
        </div>

        <DutyReportTable rows={report.dutyRows} />
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">AV &amp; Equipment Requests</h2>
            <p className="mt-1 text-sm text-slate-600">
              Clubs with AV-related responses and exact equipment details.
            </p>
          </div>
          <ExportCsvButton href={avCsvHref} fileName={avCsv.fileName} label="Export to CSV" />
        </div>

        <AvReportTable rows={report.avRows} />
      </article>
    </section>
  );
}
