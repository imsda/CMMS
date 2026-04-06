import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { getManagedClubContext } from "../../../lib/club-management";
import { buildDirectorPath } from "../../../lib/director-path";
import { prisma } from "../../../lib/prisma";

export default async function DirectorTltDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ clubId?: string }>;
}) {
  const t = await getTranslations("Director");
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const managedClub = await getManagedClubContext(resolvedSearchParams?.clubId ?? null);

  const club = await prisma.club.findUnique({
    where: {
      id: managedClub.clubId,
    },
    include: {
      rosterYears: {
        where: {
          isActive: true,
        },
        orderBy: {
          startsOn: "desc",
        },
        take: 1,
        include: {
          members: {
            where: {
              isActive: true,
              memberRole: "TLT",
            },
            orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
            include: {
              tltApplication: true,
            },
          },
        },
      },
    },
  });

  if (!club) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <h2 className="text-xl font-semibold">{t("common.clubNotFound")}</h2>
        <p className="mt-2 text-sm">{t("tlt.clubNotFoundDescription")}</p>
      </section>
    );
  }

  const activeRosterYear = club.rosterYears[0] ?? null;
  const tltMembers = activeRosterYear?.members ?? [];

  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm font-medium text-slate-500">{t("tlt.eyebrow")}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{t("tlt.title", { clubName: club.name })}</h1>
        <p className="mt-1 text-sm text-slate-600">{t("tlt.description")}</p>
      </header>

      {!activeRosterYear ? (
        <article className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <h2 className="text-lg font-semibold">{t("tlt.noActiveRoster")}</h2>
          <p className="mt-2 text-sm">{t("tlt.noActiveRosterDescription")}</p>
        </article>
      ) : tltMembers.length === 0 ? (
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">{t("tlt.noMembers")}</h2>
          <p className="mt-2 text-sm text-slate-600">{t("tlt.noMembersDescription")}</p>
        </article>
      ) : (
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">{t("tlt.statusTitle")}</h2>
            <p className="mt-1 text-sm text-slate-600">{t("tlt.activeRosterYear", { yearLabel: activeRosterYear.yearLabel })}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-700">{t("tlt.table.member")}</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-700">{t("tlt.table.grade")}</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-700">{t("tlt.table.baptized")}</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-700">{t("tlt.table.status")}</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-700">{t("tlt.table.action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tltMembers.map((member) => {
                  const application = member.tltApplication;

                  return (
                    <tr key={member.id}>
                      <td className="px-4 py-3 text-slate-900">{member.lastName}, {member.firstName}</td>
                      <td className="px-4 py-3 text-slate-700">{application?.grade ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-700">{application ? (application.isBaptized ? t("common.yes") : t("common.no")) : "—"}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {application?.status ?? "NOT_STARTED"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={buildDirectorPath(`/director/tlt/apply/${member.id}`, managedClub.clubId, managedClub.isSuperAdmin)}
                          className="inline-flex rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500"
                        >
                          {application ? t("tlt.editApplication") : t("tlt.startApplication")}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </article>
      )}
    </section>
  );
}
