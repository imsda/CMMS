"use server";

import { NominationStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "../../auth";
import { getManagedClubContext } from "../../lib/club-management";
import { buildDirectorPath, readManagedClubId } from "../../lib/director-path";
import { prisma } from "../../lib/prisma";

async function assertSuperAdmin() {
  const session = await auth();

  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    throw new Error("Only super admins can review nominations.");
  }
}

export async function getDirectorNominationPageData(clubIdOverride?: string | null) {
  const managedClub = await getManagedClubContext(clubIdOverride);
  const clubId = managedClub.clubId;

  const club = await prisma.club.findUnique({
    where: { id: clubId },
    select: { name: true },
  });

  const activeRosterYear = await prisma.clubRosterYear.findFirst({
    where: {
      clubId,
      isActive: true,
    },
    select: {
      id: true,
      yearLabel: true,
      members: {
        where: {
          isActive: true,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          memberRole: true,
        },
        orderBy: [
          { lastName: "asc" },
          { firstName: "asc" },
        ],
      },
    },
    orderBy: {
      startsOn: "desc",
    },
  });

  return {
    clubName: club?.name ?? "My Club",
    activeRosterYear,
  };
}

export async function submitNomination(formData: FormData) {
  const managedClub = await getManagedClubContext(readManagedClubId(formData.get("clubId")));
  const clubId = managedClub.clubId;

  const rosterMemberIdEntry = formData.get("rosterMemberId");
  const awardTypeEntry = formData.get("awardType");
  const yearEntry = formData.get("year");
  const justificationEntry = formData.get("justificationText");
  const communityServiceEntry = formData.get("communityServiceDetails");
  const leadershipEntry = formData.get("leadershipDetails");

  if (typeof rosterMemberIdEntry !== "string" || rosterMemberIdEntry.length === 0) {
    throw new Error("A roster member is required.");
  }

  if (typeof awardTypeEntry !== "string" || awardTypeEntry.trim().length === 0) {
    throw new Error("Award type is required.");
  }

  if (typeof yearEntry !== "string" || yearEntry.trim().length === 0) {
    throw new Error("Nomination year is required.");
  }

  if (typeof justificationEntry !== "string" || justificationEntry.trim().length === 0) {
    throw new Error("Justification is required.");
  }

  if (typeof communityServiceEntry !== "string" || communityServiceEntry.trim().length === 0) {
    throw new Error("Community service details are required.");
  }

  if (typeof leadershipEntry !== "string" || leadershipEntry.trim().length === 0) {
    throw new Error("Leadership details are required.");
  }

  const parsedYear = Number(yearEntry);
  if (Number.isNaN(parsedYear)) {
    throw new Error("Nomination year must be a valid number.");
  }

  const rosterMember = await prisma.rosterMember.findFirst({
    where: {
      id: rosterMemberIdEntry,
      isActive: true,
      clubRosterYear: {
        clubId,
        isActive: true,
      },
    },
    select: {
      id: true,
    },
  });

  if (!rosterMember) {
    throw new Error("Selected roster member was not found in your active roster.");
  }

  await prisma.nomination.create({
    data: {
      clubId,
      rosterMemberId: rosterMember.id,
      awardType: awardTypeEntry.trim(),
      year: parsedYear,
      justificationText: `${justificationEntry.trim()}\n\nLeadership: ${leadershipEntry.trim()}`,
      communityServiceDetails: communityServiceEntry.trim(),
      status: NominationStatus.SUBMITTED,
    },
  });

  revalidatePath("/director/nominations");
  revalidatePath("/admin/nominations");
  redirect(buildDirectorPath("/director/nominations", clubId, managedClub.isSuperAdmin));
}

export async function getAdminNominations() {
  await assertSuperAdmin();

  return prisma.nomination.findMany({
    include: {
      club: {
        select: {
          name: true,
          code: true,
        },
      },
      rosterMember: {
        select: {
          firstName: true,
          lastName: true,
          memberRole: true,
        },
      },
    },
    orderBy: [
      { createdAt: "desc" },
      { year: "desc" },
    ],
  });
}

export async function updateNominationStatus(formData: FormData) {
  await assertSuperAdmin();

  const nominationIdEntry = formData.get("nominationId");
  const statusEntry = formData.get("status");

  if (typeof nominationIdEntry !== "string" || nominationIdEntry.length === 0) {
    throw new Error("Nomination id is required.");
  }

  if (typeof statusEntry !== "string" || !(statusEntry in NominationStatus)) {
    throw new Error("A valid status is required.");
  }

  await prisma.nomination.update({
    where: {
      id: nominationIdEntry,
    },
    data: {
      status: statusEntry as NominationStatus,
    },
  });

  revalidatePath("/admin/nominations");
}
