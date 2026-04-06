import { UserRole } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { auth } from "../../../auth";
import { prisma } from "../../../lib/prisma";
import { AdminPageHeader } from "../_components/admin-page-header";

function formatDateTime(value: Date) {
  return value.toLocaleString();
}

export default async function AdminAuditPage() {
  const t = await getTranslations("Admin");
  const session = await auth();

  if (!session?.user || session.user.role !== UserRole.SUPER_ADMIN) {
    notFound();
  }

  const auditLogs = await prisma.auditLog.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
    include: {
      actor: {
        select: {
          name: true,
          email: true,
        },
      },
      club: {
        select: {
          name: true,
          code: true,
        },
      },
      clubRosterYear: {
        select: {
          yearLabel: true,
        },
      },
    },
  });

  return (
    <section className="space-y-6">
      <AdminPageHeader
        eyebrow={t("pages.audit.eyebrow")}
        breadcrumbs={[
          { label: t("breadcrumbs.admin"), href: "/admin/dashboard" },
          { label: t("breadcrumbs.compliance"), href: "/admin/compliance" },
          { label: t("breadcrumbs.audit") },
        ]}
        title={t("pages.audit.title")}
        description={t("pages.audit.description")}
      />

      <article className="glass-panel">
        {auditLogs.length === 0 ? (
          <p className="empty-state text-sm text-slate-600">No audit events have been recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-3">When</th>
                  <th scope="col" className="px-4 py-3">Action</th>
                  <th scope="col" className="px-4 py-3">Actor</th>
                  <th scope="col" className="px-4 py-3">Target</th>
                  <th scope="col" className="px-4 py-3">Scope</th>
                  <th scope="col" className="px-4 py-3">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="align-top">
                    <td className="px-4 py-3 text-slate-700">{formatDateTime(log.createdAt)}</td>
                    <td className="px-4 py-3 text-slate-900">
                      <p className="font-semibold">{log.action}</p>
                      <p className="text-xs text-slate-500">{log.targetType}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <p>{log.actor?.name ?? "Unknown user"}</p>
                      <p className="text-xs text-slate-500">{log.actor?.email ?? log.actorRole ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{log.targetId ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <p>{log.club ? `${log.club.name} (${log.club.code})` : "System"}</p>
                      <p className="text-xs text-slate-500">{log.clubRosterYear?.yearLabel ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <p>{log.summary}</p>
                      {log.metadata ? (
                        <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-xs text-slate-500">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      ) : null}
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
