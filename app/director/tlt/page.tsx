import Link from "next/link";

import { getManagedClubContext } from "../../../lib/club-management";
import { buildDirectorPath } from "../../../lib/director-path";
import { prisma } from "../../../lib/prisma";

export default async function DirectorTltDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ clubId?: string }>;
}) {
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
        <h2 className="text-xl font-semibold">Club not found</h2>
        <p className="mt-2 text-sm">The selected club could not be loaded for TLT applications.</p>
      </section>
    );
  }

  const activeRosterYear = club.rosterYears[0] ?? null;
  const tltMembers = activeRosterYear?.members ?? [];

  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm font-medium text-slate-500">Teen Leadership Training</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{club.name} TLT Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">Track TLT applications, baptism status, honors progress, and uniform sizing.</p>
      </header>

      {!activeRosterYear ? (
        <article className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <h2 className="text-lg font-semibold">No active roster year found</h2>
          <p className="mt-2 text-sm">Activate a roster year and assign TLT members before starting applications.</p>
        </article>
      ) : tltMembers.length === 0 ? (
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">No TLT members in active roster</h2>
          <p className="mt-2 text-sm text-slate-600">Add members with the TLT role to the active roster to begin applications.</p>
        </article>
      ) : (
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">TLT Application Status</h2>
            <p className="mt-1 text-sm text-slate-600">Active roster year: {activeRosterYear.yearLabel}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Member</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Grade</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Baptized</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tltMembers.map((member) => {
                  const application = member.tltApplication;

                  return (
                    <tr key={member.id}>
                      <td className="px-4 py-3 text-slate-900">{member.lastName}, {member.firstName}</td>
                      <td className="px-4 py-3 text-slate-700">{application?.grade ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-700">{application ? (application.isBaptized ? "Yes" : "No") : "—"}</td>
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
                          {application ? "Edit TLT Application" : "Start TLT Application"}
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
