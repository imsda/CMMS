import Link from "next/link";
import { TltApplicationStatus } from "@prisma/client";

import { getAdminTltApplications } from "../../actions/tlt-admin-actions";
import { AdminPageHeader } from "../_components/admin-page-header";

const STATUS_LABELS: Record<TltApplicationStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

const STATUS_CHIP_CLASSES: Record<TltApplicationStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-rose-100 text-rose-800",
};

type AdminTltPageProps = {
  searchParams?: Promise<{ status?: string }>;
};

export default async function AdminTltPage({ searchParams }: AdminTltPageProps) {
  const resolved = searchParams ? await searchParams : undefined;
  const rawStatus = resolved?.status?.toUpperCase();
  const statusFilter =
    rawStatus && rawStatus in TltApplicationStatus
      ? (rawStatus as TltApplicationStatus)
      : null;

  const applications = await getAdminTltApplications(statusFilter);

  return (
    <section className="space-y-8">
      <AdminPageHeader
        eyebrow="Teen Leadership Training"
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Clubs", href: "/admin/clubs" },
          { label: "TLT Applications" },
        ]}
        title="TLT Application Review"
        description="Review and approve or deny TLT applications submitted by club directors."
      />

      <article className="glass-panel">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-600">Filter by status:</span>
          {([null, "PENDING", "APPROVED", "REJECTED"] as (TltApplicationStatus | null)[]).map((s) => {
            const label = s === null ? "All" : STATUS_LABELS[s];
            const isActive = statusFilter === s;
            const href = s === null ? "/admin/tlt" : `/admin/tlt?status=${s.toLowerCase()}`;

            return (
              <Link
                key={label}
                href={href}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  isActive
                    ? "bg-slate-900 text-white"
                    : "border border-slate-300 text-slate-600 hover:border-slate-500 hover:text-slate-900"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {applications.length === 0 ? (
          <p className="px-6 py-8 text-sm text-slate-600">No TLT applications found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-3">Applicant</th>
                  <th scope="col" className="px-4 py-3">Club</th>
                  <th scope="col" className="px-4 py-3">Grade</th>
                  <th scope="col" className="px-4 py-3">TLT Year</th>
                  <th scope="col" className="px-4 py-3">Recommendations</th>
                  <th scope="col" className="px-4 py-3">Submitted</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {applications.map((app) => (
                  <tr key={app.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">
                        {app.rosterMember.lastName}, {app.rosterMember.firstName}
                      </p>
                      <p className="text-xs text-slate-500">{app.rosterMember.memberRole}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{app.club.name}</p>
                      <p className="text-xs text-slate-500">{app.club.code}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{app.grade}</td>
                    <td className="px-4 py-3 text-slate-700">Year {app.tltYearWorkingOn}</td>
                    <td className="px-4 py-3 text-slate-700">{app._count.recommendations}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {app.createdAt.toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CHIP_CLASSES[app.status]}`}
                      >
                        {STATUS_LABELS[app.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/tlt/${app.id}`}
                        className="inline-flex rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500"
                      >
                        Review
                      </Link>
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
