import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { prisma } from "../../../lib/prisma";
import { AdminPageHeader } from "../_components/admin-page-header";
import { MembershipOpsForm } from "./_components/membership-ops-form";
import { ResetPasswordForm } from "./_components/reset-password-form";
import { StudentPortalLinkForm } from "./_components/student-portal-link-form";
import { UpdateUserProfileForm } from "./_components/update-user-profile-form";
import { UserMembershipForm } from "./_components/user-membership-form";
import { UserCreateForm } from "./_components/user-create-form";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const t = await getTranslations("Admin");
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      memberships: {
        select: {
          id: true,
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
      rosterMemberLinks: {
        select: {
          id: true,
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

  const membershipOptions = users.flatMap((user) =>
    user.memberships.map((membership) => ({
      id: membership.id,
      userName: user.name,
      clubName: membership.club.name,
      clubCode: membership.club.code,
      isPrimary: membership.isPrimary,
    })),
  );
  const portalUsers = users.filter((user) => user.role === "STUDENT_PARENT");
  const rosterMembers = await prisma.rosterMember.findMany({
    where: {
      memberRole: {
        in: ["CHILD", "ADVENTURER", "PATHFINDER", "TLT"],
      },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      memberRole: true,
      clubRosterYear: {
        select: {
          yearLabel: true,
          club: {
            select: {
              name: true,
              code: true,
            },
          },
        },
      },
    },
    orderBy: [
      {
        lastName: "asc",
      },
      {
        firstName: "asc",
      },
      {
        clubRosterYear: {
          yearLabel: "desc",
        },
      },
    ],
  });
  const studentPortalLinks = await prisma.userRosterMemberLink.findMany({
    select: {
      id: true,
      user: {
        select: {
          name: true,
          email: true,
          role: true,
        },
      },
      rosterMember: {
        select: {
          firstName: true,
          lastName: true,
          memberRole: true,
          clubRosterYear: {
            select: {
              yearLabel: true,
              club: {
                select: {
                  name: true,
                  code: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: [
      {
        user: {
          name: "asc",
        },
      },
      {
        rosterMember: {
          lastName: "asc",
        },
      },
      {
        rosterMember: {
          firstName: "asc",
        },
      },
    ],
  });

  return (
    <section className="space-y-6">
      <AdminPageHeader
        eyebrow={t("pages.users.eyebrow")}
        breadcrumbs={[
          { label: t("breadcrumbs.admin"), href: "/admin/dashboard" },
          { label: t("breadcrumbs.clubs"), href: "/admin/clubs" },
          { label: t("breadcrumbs.users") },
        ]}
        title={t("pages.users.title")}
        description={t("pages.users.description")}
        secondaryActions={
          <Link href="/admin/clubs" className="btn-secondary">
            {t("actions.backToClubs")}
          </Link>
        }
      />

      <UserCreateForm clubs={clubs} />
      <UpdateUserProfileForm
        users={users.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        }))}
      />
      <UserMembershipForm
        users={users.map((user) => ({ id: user.id, name: user.name, email: user.email }))}
        clubs={clubs}
      />
      <MembershipOpsForm memberships={membershipOptions} />
      <StudentPortalLinkForm
        users={portalUsers.map((user) => ({ id: user.id, name: user.name, email: user.email }))}
        rosterMembers={rosterMembers.map((member) => ({
          id: member.id,
          firstName: member.firstName,
          lastName: member.lastName,
          memberRole: member.memberRole,
          clubName: member.clubRosterYear.club.name,
          clubCode: member.clubRosterYear.club.code,
          rosterYearLabel: member.clubRosterYear.yearLabel,
        }))}
        existingLinks={studentPortalLinks
          .filter((link) => link.user.role === "STUDENT_PARENT")
          .map((link) => ({
            id: link.id,
            userName: link.user.name,
            userEmail: link.user.email,
            rosterMemberName: `${link.rosterMember.firstName} ${link.rosterMember.lastName}`.trim(),
            memberRole: link.rosterMember.memberRole,
            clubName: link.rosterMember.clubRosterYear.club.name,
            clubCode: link.rosterMember.clubRosterYear.club.code,
            rosterYearLabel: link.rosterMember.clubRosterYear.yearLabel,
          }))}
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
                  <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-700">Name</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-700">Email</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-700">Role</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-700">Primary Club</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-700">Linked Students</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => {
                  const primaryClub = user.memberships.find((membership) => membership.isPrimary)?.club;
                  const membershipCount = user.memberships.length;
                  const linkedStudentCount = user.rosterMemberLinks.length;

                  return (
                    <tr key={user.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">{user.name}</td>
                      <td className="px-4 py-3 text-slate-700">{user.email}</td>
                      <td className="px-4 py-3 text-slate-700">{user.role}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {primaryClub ? `${primaryClub.name} (${primaryClub.code})` : "—"}
                        <span className="ml-2 text-xs text-slate-500">({membershipCount} memberships)</span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {user.role === "STUDENT_PARENT" ? linkedStudentCount : "—"}
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
