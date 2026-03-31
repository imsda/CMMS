"use server";

import { MemberRole, TltApplicationStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "../../auth";
import { sendTltApplicationDecisionEmail } from "../../lib/email/resend";
import { prisma } from "../../lib/prisma";

async function assertSuperAdmin() {
  const session = await auth();

  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    throw new Error("Only super admins can perform this action.");
  }
}

export async function getAdminTltApplications(statusFilter?: TltApplicationStatus | null) {
  await assertSuperAdmin();

  return prisma.tltApplication.findMany({
    where: statusFilter ? { status: statusFilter } : undefined,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      grade: true,
      tltYearWorkingOn: true,
      createdAt: true,
      rosterMember: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          memberRole: true,
        },
      },
      club: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      _count: {
        select: {
          recommendations: true,
        },
      },
    },
  });
}

export async function getAdminTltApplicationDetail(applicationId: string) {
  await assertSuperAdmin();

  return prisma.tltApplication.findUnique({
    where: { id: applicationId },
    include: {
      rosterMember: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          memberRole: true,
          dateOfBirth: true,
        },
      },
      club: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      recommendations: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export async function approveTltApplication(formData: FormData) {
  await assertSuperAdmin();

  const applicationId = formData.get("applicationId");
  if (typeof applicationId !== "string" || applicationId.trim().length === 0) {
    throw new Error("Application ID is required.");
  }

  const updateMemberRole = formData.get("updateMemberRole") === "on";

  const application = await prisma.tltApplication.findUnique({
    where: { id: applicationId },
    include: {
      rosterMember: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      club: {
        select: {
          id: true,
          name: true,
          memberships: {
            where: { user: { role: "CLUB_DIRECTOR" } },
            select: { user: { select: { email: true, name: true } } },
            take: 1,
          },
        },
      },
    },
  });

  if (!application) {
    throw new Error("TLT application not found.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.tltApplication.update({
      where: { id: applicationId },
      data: { status: TltApplicationStatus.APPROVED },
    });

    if (updateMemberRole) {
      await tx.rosterMember.update({
        where: { id: application.rosterMemberId },
        data: { memberRole: MemberRole.TLT },
      });
    }
  });

  const directorUser = application.club.memberships[0]?.user ?? null;
  if (directorUser?.email) {
    const applicantName = `${application.rosterMember.firstName} ${application.rosterMember.lastName}`;
    await sendTltApplicationDecisionEmail({
      to: directorUser.email,
      directorName: directorUser.name ?? directorUser.email,
      clubName: application.club.name,
      applicantName,
      decision: "APPROVED",
    }).catch((err: unknown) => {
      console.error("Failed to send TLT approval email:", err);
    });
  }

  revalidatePath("/admin/tlt");
  revalidatePath(`/admin/tlt/${applicationId}`);
}

export async function denyTltApplication(formData: FormData) {
  await assertSuperAdmin();

  const applicationId = formData.get("applicationId");
  if (typeof applicationId !== "string" || applicationId.trim().length === 0) {
    throw new Error("Application ID is required.");
  }

  const application = await prisma.tltApplication.findUnique({
    where: { id: applicationId },
    include: {
      rosterMember: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      club: {
        select: {
          id: true,
          name: true,
          memberships: {
            where: { user: { role: "CLUB_DIRECTOR" } },
            select: { user: { select: { email: true, name: true } } },
            take: 1,
          },
        },
      },
    },
  });

  if (!application) {
    throw new Error("TLT application not found.");
  }

  await prisma.tltApplication.update({
    where: { id: applicationId },
    data: { status: TltApplicationStatus.REJECTED },
  });

  const directorUser = application.club.memberships[0]?.user ?? null;
  if (directorUser?.email) {
    const applicantName = `${application.rosterMember.firstName} ${application.rosterMember.lastName}`;
    await sendTltApplicationDecisionEmail({
      to: directorUser.email,
      directorName: directorUser.name ?? directorUser.email,
      clubName: application.club.name,
      applicantName,
      decision: "REJECTED",
    }).catch((err: unknown) => {
      console.error("Failed to send TLT denial email:", err);
    });
  }

  revalidatePath("/admin/tlt");
  revalidatePath(`/admin/tlt/${applicationId}`);
}

export async function getPendingTltApplicationCount() {
  await assertSuperAdmin();

  return prisma.tltApplication.count({
    where: { status: TltApplicationStatus.PENDING },
  });
}
