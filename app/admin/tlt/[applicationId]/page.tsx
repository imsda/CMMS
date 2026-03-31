import Link from "next/link";
import { TltApplicationStatus } from "@prisma/client";
import { notFound } from "next/navigation";

import {
  approveTltApplication,
  denyTltApplication,
  getAdminTltApplicationDetail,
} from "../../../actions/tlt-admin-actions";
import { AdminPageHeader } from "../../_components/admin-page-header";

const STATUS_CHIP_CLASSES: Record<TltApplicationStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-rose-100 text-rose-800",
};

type AdminTltDetailPageProps = {
  params: Promise<{ applicationId: string }>;
};

export default async function AdminTltDetailPage({ params }: AdminTltDetailPageProps) {
  const { applicationId } = await params;
  const application = await getAdminTltApplicationDetail(applicationId);

  if (!application) {
    notFound();
  }

  const applicantName = `${application.rosterMember.firstName} ${application.rosterMember.lastName}`;
  const completedClasses = Array.isArray(application.classesCompleted)
    ? (application.classesCompleted as string[])
    : [];

  return (
    <section className="space-y-8">
      <AdminPageHeader
        eyebrow="Teen Leadership Training"
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "TLT Applications", href: "/admin/tlt" },
          { label: applicantName },
        ]}
        title={applicantName}
        description={`TLT application from ${application.club.name} — ${application.club.code}`}
      />

      {/* Status + Review Actions */}
      <article className="glass-panel">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-600">Current status</p>
            <span
              className={`mt-1 inline-block rounded-full px-3 py-1 text-sm font-semibold ${STATUS_CHIP_CLASSES[application.status]}`}
            >
              {application.status}
            </span>
          </div>

          {application.status === TltApplicationStatus.PENDING ? (
            <div className="flex flex-wrap gap-3">
              <form action={approveTltApplication}>
                <input type="hidden" name="applicationId" value={application.id} />
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-sm text-slate-700">
                    <input type="checkbox" name="updateMemberRole" className="rounded border-slate-300" />
                    Set member role to TLT
                  </label>
                  <button
                    type="submit"
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
                  >
                    Approve
                  </button>
                </div>
              </form>

              <form action={denyTltApplication}>
                <input type="hidden" name="applicationId" value={application.id} />
                <button
                  type="submit"
                  className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500"
                >
                  Deny
                </button>
              </form>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              This application has already been reviewed.{" "}
              <Link href="/admin/tlt" className="text-indigo-600 underline underline-offset-2">
                Back to list
              </Link>
            </p>
          )}
        </div>
      </article>

      {/* Application Details */}
      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Application Details</h2>

        <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="font-medium text-slate-500">Grade</dt>
            <dd className="mt-0.5 text-slate-900">{application.grade}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Citizenship</dt>
            <dd className="mt-0.5 text-slate-900">{application.citizenship}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Baptized</dt>
            <dd className="mt-0.5 text-slate-900">{application.isBaptized ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">TLT Year Working On</dt>
            <dd className="mt-0.5 text-slate-900">Year {application.tltYearWorkingOn}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">T-Shirt Size</dt>
            <dd className="mt-0.5 text-slate-900">{application.tShirtSize}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Polo Size</dt>
            <dd className="mt-0.5 text-slate-900">{application.poloSize}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">School</dt>
            <dd className="mt-0.5 text-slate-900">{application.schoolName}</dd>
          </div>
          <div className="col-span-2">
            <dt className="font-medium text-slate-500">School Address</dt>
            <dd className="mt-0.5 text-slate-900">{application.schoolAddress}</dd>
          </div>
          <div className="col-span-full">
            <dt className="font-medium text-slate-500">Classes Completed</dt>
            <dd className="mt-1">
              {completedClasses.length > 0 ? (
                <ul className="flex flex-wrap gap-1.5">
                  {completedClasses.map((cls) => (
                    <li
                      key={cls}
                      className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700"
                    >
                      {cls}
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-slate-500">None listed.</span>
              )}
            </dd>
          </div>
        </dl>
      </article>

      {/* Recommendations */}
      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Recommendations</h2>
          <p className="mt-0.5 text-sm text-slate-600">
            {application.recommendations.length} recommendation request{application.recommendations.length !== 1 ? "s" : ""} on file.
          </p>
        </div>

        {application.recommendations.length === 0 ? (
          <p className="px-6 py-5 text-sm text-slate-600">No recommendations have been requested yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Recommender</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Relationship</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Submitted</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Qualities</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Stress Response</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {application.recommendations.map((rec) => (
                  <tr key={rec.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{rec.recommenderName ?? "—"}</p>
                      <p className="text-xs text-slate-500">{rec.recommenderEmail}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{rec.relationship ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          rec.status === "COMPLETED"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {rec.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {rec.submittedAt ? rec.submittedAt.toLocaleDateString() : "—"}
                    </td>
                    <td className="max-w-xs whitespace-pre-wrap px-4 py-3 text-slate-700">
                      {rec.qualities ?? "—"}
                    </td>
                    <td className="max-w-xs whitespace-pre-wrap px-4 py-3 text-slate-700">
                      {rec.stressResponse ?? "—"}
                    </td>
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
