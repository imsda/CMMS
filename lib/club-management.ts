import { UserRole } from "@prisma/client";
import { prisma } from "./prisma";

import { auth } from "../auth";
export type ManagedClubContext = {
  clubId: string;
  clubName: string;
  isSuperAdmin: boolean;
  userId: string;
  userEmail: string | null;
};

export async function getManagedClubContext(clubIdOverride?: string | null): Promise<ManagedClubContext> {
  const session = await auth();

  if (!session?.user) {
    throw new Error("You must be signed in to manage clubs.");
  }

  if (session.user.role === UserRole.CLUB_DIRECTOR) {
    const membership = await prisma.clubMembership.findFirst({
      where: {
        userId: session.user.id,
      },
      select: {
        clubId: true,
        club: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        isPrimary: "desc",
      },
    });

    if (!membership?.club) {
      throw new Error("No club membership found for current user.");
    }

    return {
      clubId: membership.clubId,
      clubName: membership.club.name,
      isSuperAdmin: false,
      userId: session.user.id,
      userEmail: session.user.email ?? null,
    };
  }

  if (session.user.role === UserRole.SUPER_ADMIN) {
    if (!clubIdOverride) {
      throw new Error("Select a club before opening director workflows as Super Admin.");
    }

    const club = await prisma.club.findUnique({
      where: {
        id: clubIdOverride,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!club) {
      throw new Error("Selected club was not found.");
    }

    return {
      clubId: club.id,
      clubName: club.name,
      isSuperAdmin: true,
      userId: session.user.id,
      userEmail: session.user.email ?? null,
    };
  }

  throw new Error("Only club directors and super admins can manage club workflows.");
}
