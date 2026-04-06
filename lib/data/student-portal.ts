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
    classTitle: string | null;
    eventStartsAt: Date;
    eventEndsAt: Date;
    locationName: string | null;
    locationAddress: string | null;
    eventBringNote: string | null;
    rosterMemberName: string;
  }>;
  directorContacts: Array<{
    name: string;
    email: string;
    clubName: string;
  }>;
};

export type LinkedRosterMember = {
  id: string;
  firstName: string;
  lastName: string;
  memberRole: string;
  clubId: string;
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

type LinkedAttendance = {
  rosterMemberId: string;
  eventRegistration: {
    event: {
      id: string;
      name: string;
      startsAt: Date;
      endsAt: Date;
      locationName: string | null;
      locationAddress: string | null;
      eventBringNote: string | null;
    };
  };
};

type LinkedEnrollment = {
  rosterMemberId: string;
  offering: {
    eventId: string;
    classCatalog: {
      title: string;
    };
  };
};

type DirectorContact = {
  name: string;
  email: string;
  clubId: string;
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
                  id: true,
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
      clubId: member.clubRosterYear.club.id,
      clubName: member.clubRosterYear.club.name,
      clubCode: member.clubRosterYear.club.code,
      rosterYearLabel: member.clubRosterYear.yearLabel,
    }));
}

export function buildStudentPortalData(input: {
  linkedRosterMembers: LinkedRosterMember[];
  completedRequirements: LinkedRequirement[];
  upcomingAttendances: LinkedAttendance[];
  upcomingEnrollments: LinkedEnrollment[];
  honorCatalog: Array<{
    code: string;
    title: string;
  }>;
  directorContacts: DirectorContact[];
}): StudentPortalData {
  if (input.linkedRosterMembers.length === 0) {
    return {
      linkedStudents: [],
      completedHonors: [],
      eventClassAssignments: [],
      directorContacts: [],
    };
  }

  const linkedRosterMemberIds = new Set(input.linkedRosterMembers.map((member) => member.id));
  const rosterMemberNameById = new Map(
    input.linkedRosterMembers.map((member) => [member.id, getRosterMemberDisplayName(member)]),
  );
  const honorByCode = new Map(input.honorCatalog.map((item) => [item.code, item.title]));

  // Build a map of (memberId, eventId) -> classTitle for quick lookup
  const enrollmentMap = new Map<string, string>();
  for (const enrollment of input.upcomingEnrollments) {
    if (linkedRosterMemberIds.has(enrollment.rosterMemberId)) {
      const key = `${enrollment.rosterMemberId}::${enrollment.offering.eventId}`;
      enrollmentMap.set(key, enrollment.offering.classCatalog.title);
    }
  }

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

  // Build club -> director mapping for display
  const clubDirectorMap = new Map<string, DirectorContact>();
  for (const director of input.directorContacts) {
    clubDirectorMap.set(director.clubId, director);
  }

  // Collect unique club IDs for the linked members to build director list
  const linkedClubIds = new Set(input.linkedRosterMembers.map((m) => m.clubId));
  const clubNameById = new Map(
    input.linkedRosterMembers.map((m) => [m.clubId, m.clubName]),
  );

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
    eventClassAssignments: input.upcomingAttendances
      .filter((attendance) => linkedRosterMemberIds.has(attendance.rosterMemberId))
      .map((attendance) => {
        const event = attendance.eventRegistration.event;
        const enrollmentKey = `${attendance.rosterMemberId}::${event.id}`;
        const classTitle = enrollmentMap.get(enrollmentKey) ?? null;
        return {
          enrollmentId: `${attendance.rosterMemberId}::${event.id}`,
          eventName: event.name,
          classTitle,
          eventStartsAt: event.startsAt,
          eventEndsAt: event.endsAt,
          locationName: event.locationName,
          locationAddress: event.locationAddress,
          eventBringNote: event.eventBringNote,
          rosterMemberName: rosterMemberNameById.get(attendance.rosterMemberId) ?? "Linked Student",
        };
      }),
    directorContacts: [...linkedClubIds]
      .map((clubId) => {
        const director = clubDirectorMap.get(clubId);
        if (!director) return null;
        return {
          name: director.name,
          email: director.email,
          clubName: clubNameById.get(clubId) ?? "",
        };
      })
      .filter((d): d is { name: string; email: string; clubName: string } => d !== null),
  };
}

export async function getStudentPortalData(userId: string): Promise<StudentPortalData> {
  const linkedRosterMembers = await getLinkedRosterMembers(userId);

  if (linkedRosterMembers.length === 0) {
    return buildStudentPortalData({
      linkedRosterMembers,
      completedRequirements: [],
      upcomingAttendances: [],
      upcomingEnrollments: [],
      honorCatalog: [],
      directorContacts: [],
    });
  }

  const linkedRosterMemberIds = linkedRosterMembers.map((member) => member.id);
  const uniqueClubIds = [...new Set(linkedRosterMembers.map((m) => m.clubId))];
  const now = new Date();

  const [completedRequirements, upcomingAttendances, upcomingEnrollments, primaryMemberships] =
    await Promise.all([
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
      prisma.registrationAttendee.findMany({
        where: {
          rosterMemberId: {
            in: linkedRosterMemberIds,
          },
          eventRegistration: {
            event: {
              endsAt: {
                gte: now,
              },
            },
          },
        },
        select: {
          rosterMemberId: true,
          eventRegistration: {
            select: {
              event: {
                select: {
                  id: true,
                  name: true,
                  startsAt: true,
                  endsAt: true,
                  locationName: true,
                  locationAddress: true,
                  eventBringNote: true,
                },
              },
            },
          },
        },
        orderBy: [
          {
            eventRegistration: {
              event: {
                startsAt: "asc",
              },
            },
          },
        ],
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
          rosterMemberId: true,
          offering: {
            select: {
              eventId: true,
              classCatalog: {
                select: {
                  title: true,
                },
              },
            },
          },
        },
      }),
      prisma.clubMembership.findMany({
        where: {
          clubId: {
            in: uniqueClubIds,
          },
          isPrimary: true,
        },
        select: {
          clubId: true,
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
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

  const directorContacts: DirectorContact[] = primaryMemberships.map((m) => ({
    clubId: m.clubId,
    name: m.user.name,
    email: m.user.email,
  }));

  return buildStudentPortalData({
    linkedRosterMembers,
    completedRequirements,
    upcomingAttendances,
    upcomingEnrollments,
    honorCatalog,
    directorContacts,
  });
}
