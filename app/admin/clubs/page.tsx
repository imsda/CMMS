import Link from "next/link";
import { ClubType } from "@prisma/client";

import { prisma } from "../../../lib/prisma";
import { ClubCreateForm } from "./_components/club-create-form";
import { ClubUpdateForm } from "./_components/club-update-form";

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
      <header className="glass-panel">
        <p className="hero-kicker">Super Admin</p>
        <h1 className="hero-title mt-3">Club Directory</h1>
        <p className="hero-copy">
          Review conference clubs and current participation counts.
        </p>
      </header>

      <ClubCreateForm />
      <ClubUpdateForm
        clubs={clubs.map((club) => ({
          id: club.id,
          name: club.name,
          code: club.code,
          type: club.type as ClubType,
          city: club.city,
          state: club.state,
        }))}
      />

      <article className="glass-table table-shell overflow-hidden">
        {clubs.length === 0 ? (
          <p className="empty-state m-4 text-sm text-slate-600">No clubs found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Club</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Type</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Location</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Users</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Roster Years</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
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
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/director/dashboard?clubId=${club.id}`}
                          className="btn-primary px-3 py-1.5 text-xs"
                        >
                          Open Director Workspace
                        </Link>
                        <Link
                          href={`/admin/dashboard`}
                          className="btn-secondary px-3 py-1.5 text-xs"
                        >
                          Back to Dashboard
                        </Link>
                      </div>
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
