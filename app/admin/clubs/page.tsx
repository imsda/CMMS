import Link from "next/link";

import { prisma } from "../../../lib/prisma";
import { ClubCreateForm } from "./_components/club-create-form";

export const dynamic = "force-dynamic";

export default async function AdminClubsPage() {
  const clubs = await prisma.club.findMany({
    select: {
      id: true,
      name: true,
      code: true,
      type: true,
      city: true,
      state: true,
      _count: {
        select: {
          memberships: true,
          rosterYears: true,
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Super Admin</p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-900">Club Directory</h1>
        <p className="mt-2 text-sm text-slate-600">
          Review conference clubs and current participation counts.
        </p>
      </header>

      <ClubCreateForm />

      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {clubs.length === 0 ? (
          <p className="px-6 py-5 text-sm text-slate-600">No clubs found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Club</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Type</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Location</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Users</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Roster Years</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clubs.map((club) => (
                  <tr key={club.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{club.name}</p>
                      <p className="text-xs text-slate-500">{club.code}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{club.type}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {[club.city, club.state].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{club._count.memberships}</td>
                    <td className="px-4 py-3 text-slate-700">{club._count.rosterYears}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/dashboard`}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700"
                      >
                        Back to Dashboard
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
