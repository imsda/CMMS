import { prisma } from "../../../lib/prisma";
import { ResetPasswordForm } from "./_components/reset-password-form";
import { UserMembershipForm } from "./_components/user-membership-form";
import { UserCreateForm } from "./_components/user-create-form";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      memberships: {
        select: {
          title: true,
          isPrimary: true,
          club: {
            select: {
              name: true,
              code: true,
            },
          },
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  const clubs = await prisma.club.findMany({
    select: {
      id: true,
      name: true,
      code: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Super Admin</p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-900">User Directory</h1>
        <p className="mt-2 text-sm text-slate-600">
          Review account roles and primary club assignments.
        </p>
      </header>

      <UserCreateForm clubs={clubs} />
      <UserMembershipForm
        users={users.map((user) => ({ id: user.id, name: user.name, email: user.email }))}
        clubs={clubs}
      />
      <ResetPasswordForm users={users.map((user) => ({ id: user.id, name: user.name, email: user.email }))} />

      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {users.length === 0 ? (
          <p className="px-6 py-5 text-sm text-slate-600">No users found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Email</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Role</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Primary Club</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => {
                  const primaryClub = user.memberships.find((membership) => membership.isPrimary)?.club;
                  const membershipCount = user.memberships.length;

                  return (
                    <tr key={user.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">{user.name}</td>
                      <td className="px-4 py-3 text-slate-700">{user.email}</td>
                      <td className="px-4 py-3 text-slate-700">{user.role}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {primaryClub ? `${primaryClub.name} (${primaryClub.code})` : "—"}
                        <span className="ml-2 text-xs text-slate-500">({membershipCount} memberships)</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}
