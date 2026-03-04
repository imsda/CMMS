import { RequirementType, type Prisma } from "@prisma/client";

import { prisma } from "../prisma";

type StudentPortalData = {
  completedHonors: Array<{
    id: string;
    honorCode: string;
    honorTitle: string;
    completedAt: Date;
    rosterMemberName: string;
  }>;
  schedule: Array<{
    enrollmentId: string;
    eventName: string;
    classTitle: string;
    startsAt: Date;
    endsAt: Date;
    location: string | null;
    rosterMemberName: string;
  }>;
};

type LinkedRosterMember = {
  id: string;
  firstName: string;
  lastName: string;
};

function getRosterMemberName(member: { firstName: string; lastName: string }) {
  return `${member.firstName} ${member.lastName}`.trim();
}

function readHonorCodeFromMetadata(metadata: Prisma.JsonValue): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = (metadata as Record<string, unknown>).honorCode;
  return typeof value === "string" && value.trim().length > 0 ? value.trim().toUpperCase() : null;
}

async function getLinkedRosterMembers(userId: string): Promise<LinkedRosterMember[]> {
  return prisma.rosterMember.findMany({
    where: {
      completedRequirements: {
        some: {
          userId,
        },
      },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

export async function getStudentPortalData(userId: string): Promise<StudentPortalData> {
  const linkedRosterMembers = await getLinkedRosterMembers(userId);

  if (linkedRosterMembers.length === 0) {
    return {
      completedHonors: [],
      schedule: [],
    };
  }

  const linkedRosterMemberIds = linkedRosterMembers.map((member) => member.id);
  const rosterMemberNameById = new Map(
    linkedRosterMembers.map((member) => [member.id, getRosterMemberName(member)]),
  );
  const now = new Date();

  const [completedRequirements, upcomingEnrollments] = await Promise.all([
    prisma.memberRequirement.findMany({
      where: {
        rosterMemberId: {
          in: linkedRosterMemberIds,
        },
        requirementType: RequirementType.COMPLETED_HONOR,
      },
      select: {
        id: true,
        metadata: true,
        completedAt: true,
        rosterMemberId: true,
      },
      orderBy: [{ completedAt: "desc" }],
    }),
    prisma.classEnrollment.findMany({
      where: {
        rosterMemberId: {
          in: linkedRosterMemberIds,
        },
        offering: {
          event: {
            endsAt: {
              gte: now,
            },
          },
        },
      },
      select: {
        id: true,
        rosterMemberId: true,
        offering: {
          select: {
            classCatalog: {
              select: {
                title: true,
              },
            },
            event: {
              select: {
                name: true,
                startsAt: true,
                endsAt: true,
                locationName: true,
              },
            },
          },
        },
      },
      orderBy: [
        {
          offering: {
            event: {
              startsAt: "asc",
            },
          },
        },
        {
          offering: {
            classCatalog: {
              title: "asc",
            },
          },
        },
      ],
    }),
  ]);

  const completedHonorEntries = completedRequirements
    .map((requirement) => ({
      ...requirement,
      honorCode: readHonorCodeFromMetadata(requirement.metadata),
    }))
    .filter((requirement): requirement is typeof requirement & { honorCode: string } => Boolean(requirement.honorCode));

  const uniqueHonorCodes = [...new Set(completedHonorEntries.map((item) => item.honorCode))];
  const honorCatalog =
    uniqueHonorCodes.length === 0
      ? []
      : await prisma.classCatalog.findMany({
          where: {
            code: {
              in: uniqueHonorCodes,
            },
          },
          select: {
            code: true,
            title: true,
          },
        });

  const honorByCode = new Map(honorCatalog.map((item) => [item.code, item.title]));

  return {
    completedHonors: completedHonorEntries.map((requirement) => ({
      id: requirement.id,
      honorCode: requirement.honorCode,
      honorTitle: honorByCode.get(requirement.honorCode) ?? requirement.honorCode,
      completedAt: requirement.completedAt,
      rosterMemberName:
        requirement.rosterMemberId === null
          ? "Linked Student"
          : rosterMemberNameById.get(requirement.rosterMemberId) ?? "Linked Student",
    })),
    schedule: upcomingEnrollments.map((enrollment) => ({
      enrollmentId: enrollment.id,
      eventName: enrollment.offering.event.name,
      classTitle: enrollment.offering.classCatalog.title,
      startsAt: enrollment.offering.event.startsAt,
      endsAt: enrollment.offering.event.endsAt,
      location: enrollment.offering.event.locationName,
      rosterMemberName:
        rosterMemberNameById.get(enrollment.rosterMemberId) ?? "Linked Student",
    })),
  };
}
