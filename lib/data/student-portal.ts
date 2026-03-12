import { RequirementType, type Prisma } from "@prisma/client";

import { prisma } from "../prisma";
import {
  getRosterMemberDisplayName,
  isStudentPortalEligibleMemberRole,
  STUDENT_PORTAL_MEMBER_ROLES,
} from "../student-portal-links";

export type StudentPortalData = {
  linkedStudents: Array<{
    rosterMemberId: string;
    rosterMemberName: string;
    memberRole: string;
    clubName: string;
    clubCode: string;
    rosterYearLabel: string;
  }>;
  completedHonors: Array<{
    id: string;
    honorCode: string;
    honorTitle: string;
    completedAt: Date;
    rosterMemberName: string;
  }>;
  eventClassAssignments: Array<{
    enrollmentId: string;
    eventName: string;
    classTitle: string;
    eventStartsAt: Date;
    eventEndsAt: Date;
    location: string | null;
    rosterMemberName: string;
  }>;
};

export type LinkedRosterMember = {
  id: string;
  firstName: string;
  lastName: string;
  memberRole: string;
  clubName: string;
  clubCode: string;
  rosterYearLabel: string;
};

type LinkedRequirement = {
  id: string;
  metadata: Prisma.JsonValue;
  completedAt: Date;
  rosterMemberId: string | null;
};

type LinkedEnrollment = {
  id: string;
  rosterMemberId: string;
  offering: {
    classCatalog: {
      title: string;
    };
    event: {
      name: string;
      startsAt: Date;
      endsAt: Date;
      locationName: string | null;
    };
  };
};

function readHonorCodeFromMetadata(metadata: Prisma.JsonValue): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = (metadata as Record<string, unknown>).honorCode;
  return typeof value === "string" && value.trim().length > 0 ? value.trim().toUpperCase() : null;
}

async function getLinkedRosterMembers(userId: string): Promise<LinkedRosterMember[]> {
  const links = await prisma.userRosterMemberLink.findMany({
    where: {
      userId,
      rosterMember: {
        memberRole: {
          in: STUDENT_PORTAL_MEMBER_ROLES,
        },
      },
    },
    select: {
      rosterMember: {
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
      },
    },
    orderBy: [
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
      {
        rosterMember: {
          clubRosterYear: {
            yearLabel: "desc",
          },
        },
      },
    ],
  });

  return links
    .map((link) => link.rosterMember)
    .filter((member) => isStudentPortalEligibleMemberRole(member.memberRole))
    .map((member) => ({
      id: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
      memberRole: member.memberRole,
      clubName: member.clubRosterYear.club.name,
      clubCode: member.clubRosterYear.club.code,
      rosterYearLabel: member.clubRosterYear.yearLabel,
    }));
}

export function buildStudentPortalData(input: {
  linkedRosterMembers: LinkedRosterMember[];
  completedRequirements: LinkedRequirement[];
  upcomingEnrollments: LinkedEnrollment[];
  honorCatalog: Array<{
    code: string;
    title: string;
  }>;
}): StudentPortalData {
  if (input.linkedRosterMembers.length === 0) {
    return {
      linkedStudents: [],
      completedHonors: [],
      eventClassAssignments: [],
    };
  }

  const linkedRosterMemberIds = new Set(input.linkedRosterMembers.map((member) => member.id));
  const rosterMemberNameById = new Map(
    input.linkedRosterMembers.map((member) => [member.id, getRosterMemberDisplayName(member)]),
  );
  const honorByCode = new Map(input.honorCatalog.map((item) => [item.code, item.title]));

  const completedHonorEntries = input.completedRequirements
    .filter(
      (requirement) =>
        requirement.rosterMemberId !== null && linkedRosterMemberIds.has(requirement.rosterMemberId),
    )
    .map((requirement) => ({
      ...requirement,
      honorCode: readHonorCodeFromMetadata(requirement.metadata),
    }))
    .filter((requirement): requirement is typeof requirement & { honorCode: string } => Boolean(requirement.honorCode));

  return {
    linkedStudents: input.linkedRosterMembers.map((member) => ({
      rosterMemberId: member.id,
      rosterMemberName: getRosterMemberDisplayName(member),
      memberRole: member.memberRole,
      clubName: member.clubName,
      clubCode: member.clubCode,
      rosterYearLabel: member.rosterYearLabel,
    })),
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
    eventClassAssignments: input.upcomingEnrollments
      .filter((enrollment) => linkedRosterMemberIds.has(enrollment.rosterMemberId))
      .map((enrollment) => ({
        enrollmentId: enrollment.id,
        eventName: enrollment.offering.event.name,
        classTitle: enrollment.offering.classCatalog.title,
        eventStartsAt: enrollment.offering.event.startsAt,
        eventEndsAt: enrollment.offering.event.endsAt,
        location: enrollment.offering.event.locationName,
        rosterMemberName:
          rosterMemberNameById.get(enrollment.rosterMemberId) ?? "Linked Student",
      })),
  };
}

export async function getStudentPortalData(userId: string): Promise<StudentPortalData> {
  const linkedRosterMembers = await getLinkedRosterMembers(userId);

  if (linkedRosterMembers.length === 0) {
    return buildStudentPortalData({
      linkedRosterMembers,
      completedRequirements: [],
      upcomingEnrollments: [],
      honorCatalog: [],
    });
  }

  const linkedRosterMemberIds = linkedRosterMembers.map((member) => member.id);
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

  return buildStudentPortalData({
    linkedRosterMembers,
    completedRequirements,
    upcomingEnrollments,
    honorCatalog,
  });
}
