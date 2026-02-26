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
      },
      select: {
        id: true,
        honorCode: true,
        completedAt: true,
        rosterMemberId: true,
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
          event: {
            endsAt: {
              gte: now,
            },
          },
          startsAt: {
            gte: now,
          },
        },
      },
      select: {
        id: true,
        rosterMemberId: true,
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
    completedHonors: completedRequirements.map((requirement) => ({
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
      eventName: enrollment.eventClassOffering.event.name,
      classTitle: enrollment.eventClassOffering.classCatalog.title,
      startsAt: enrollment.eventClassOffering.startsAt,
      endsAt: enrollment.eventClassOffering.endsAt,
      location: enrollment.eventClassOffering.location,
      rosterMemberName:
        rosterMemberNameById.get(enrollment.rosterMemberId) ?? "Linked Student",
    })),
  };
}
