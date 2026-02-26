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

function getRosterMemberName(member: { firstName: string; lastName: string }) {
  return `${member.firstName} ${member.lastName}`.trim();
}

async function getLinkedRosterMemberIds(userId: string) {
  const linkedRequirements = await prisma.memberRequirement.findMany({
    where: {
      userId,
      rosterMemberId: {
        not: null,
      },
    },
    select: {
      rosterMemberId: true,
    },
    distinct: ["rosterMemberId"],
  });

  return linkedRequirements
    .map((record) => record.rosterMemberId)
    .filter((record): record is string => record !== null);
}

export async function getStudentPortalData(userId: string): Promise<StudentPortalData> {
  const linkedRosterMemberIds = await getLinkedRosterMemberIds(userId);

  if (linkedRosterMemberIds.length === 0) {
    return {
      completedHonors: [],
      schedule: [],
    };
  }

  const [completedRequirements, upcomingEnrollments] = await Promise.all([
    prisma.memberRequirement.findMany({
      where: {
        rosterMemberId: {
          in: linkedRosterMemberIds,
        },
      },
      select: {
        id: true,
        honorCode: true,
        completedAt: true,
        rosterMember: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [{ completedAt: "desc" }, { honorCode: "asc" }],
    }),
    prisma.classEnrollment.findMany({
      where: {
        rosterMemberId: {
          in: linkedRosterMemberIds,
        },
        isWaitlisted: false,
        eventClassOffering: {
          startsAt: {
            gte: new Date(),
          },
        },
      },
      select: {
        id: true,
        rosterMember: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        eventClassOffering: {
          select: {
            startsAt: true,
            endsAt: true,
            location: true,
            classCatalog: {
              select: {
                title: true,
              },
            },
            event: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: [
        {
          eventClassOffering: {
            startsAt: "asc",
          },
        },
        {
          eventClassOffering: {
            classCatalog: {
              title: "asc",
            },
          },
        },
      ],
    }),
  ]);

  const uniqueHonorCodes = [...new Set(completedRequirements.map((item) => item.honorCode))];

  const honorCatalog = await prisma.classCatalog.findMany({
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
    completedHonors: completedRequirements.map((requirement) => ({
      id: requirement.id,
      honorCode: requirement.honorCode,
      honorTitle: honorByCode.get(requirement.honorCode) ?? requirement.honorCode,
      completedAt: requirement.completedAt,
      rosterMemberName: requirement.rosterMember
        ? getRosterMemberName(requirement.rosterMember)
        : "Linked Student",
    })),
    schedule: upcomingEnrollments.map((enrollment) => ({
      enrollmentId: enrollment.id,
      eventName: enrollment.eventClassOffering.event.name,
      classTitle: enrollment.eventClassOffering.classCatalog.title,
      startsAt: enrollment.eventClassOffering.startsAt,
      endsAt: enrollment.eventClassOffering.endsAt,
      location: enrollment.eventClassOffering.location,
      rosterMemberName: getRosterMemberName(enrollment.rosterMember),
    })),
  };
}
