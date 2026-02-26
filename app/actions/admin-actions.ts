"use server";

import { ClassType, MemberRole, RequirementType, type Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "../../auth";
import { prisma } from "../../lib/prisma";

type ParsedRequirementInput = {
  requirementType: RequirementType;
  minAge: number | null;
  maxAge: number | null;
  requiredMemberRole: MemberRole | null;
  requiredHonorCode: string | null;
  requiredMasterGuide: boolean | null;
};

function ensureSuperAdmin(session: Awaited<ReturnType<typeof auth>>) {
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    throw new Error("Only super admins can perform this action.");
  }
}

function requireTrimmedString(value: FormDataEntryValue | null, label: string) {
  if (typeof value !== "string") {
    throw new Error(`${label} is required.`);
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${label} is required.`);
  }

  return trimmed;
}

function optionalTrimmedString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function parseClassType(value: FormDataEntryValue | null) {
  const type = requireTrimmedString(value, "Class type");

  if (!Object.values(ClassType).includes(type as ClassType)) {
    throw new Error("Class type is invalid.");
  }

  return type as ClassType;
}

function parseRequirementType(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim().length === 0 || value === "NONE") {
    return null;
  }

  if (!Object.values(RequirementType).includes(value as RequirementType)) {
    throw new Error("Requirement type is invalid.");
  }

  return value as RequirementType;
}

function parseOptionalInt(value: FormDataEntryValue | null, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`${label} must be a valid whole number.`);
  }

  return parsed;
}

function parseOptionalMemberRole(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim().length === 0 || value === "NONE") {
    return null;
  }

  if (!Object.values(MemberRole).includes(value as MemberRole)) {
    throw new Error("Required member role is invalid.");
  }

  return value as MemberRole;
}

function parseOptionalBoolean(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim().length === 0 || value === "NONE") {
    return null;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error("Boolean value is invalid.");
}

function parseRequirementFromFormData(formData: FormData): ParsedRequirementInput | null {
  const requirementType = parseRequirementType(formData.get("requirementType"));
  if (!requirementType) {
    return null;
  }

  return {
    requirementType,
    minAge: parseOptionalInt(formData.get("minAge"), "Minimum age"),
    maxAge: parseOptionalInt(formData.get("maxAge"), "Maximum age"),
    requiredMemberRole: parseOptionalMemberRole(formData.get("requiredMemberRole")),
    requiredHonorCode: optionalTrimmedString(formData.get("requiredHonorCode")),
    requiredMasterGuide: parseOptionalBoolean(formData.get("requiredMasterGuide")),
  };
}

export async function getAdminDashboardOverview() {
  const session = await auth();
  ensureSuperAdmin(session);

  const now = new Date();

  const [totalActiveClubs, totalConferenceMembers, upcomingEvents] = await Promise.all([
    prisma.club.count(),
    prisma.rosterMember.count({
      where: {
        isActive: true,
        clubRosterYear: {
          isActive: true,
        },
      },
    }),
    prisma.event.findMany({
      where: {
        endsAt: {
          gte: now,
        },
      },
      orderBy: {
        startsAt: "asc",
      },
      take: 6,
      include: {
        _count: {
          select: {
            registrations: true,
          },
        },
      },
    }),
  ]);

  return {
    totalActiveClubs,
    totalConferenceMembers,
    upcomingEvents,
  };
}

export async function getMasterCatalogData() {
  const session = await auth();
  ensureSuperAdmin(session);

  const catalog = await prisma.classCatalog.findMany({
    orderBy: [{ active: "desc" }, { title: "asc" }],
    include: {
      requirements: {
        orderBy: {
          requirementType: "asc",
        },
      },
      _count: {
        select: {
          offerings: true,
        },
      },
    },
  });

  return catalog;
}

export async function createMasterCatalogItem(formData: FormData) {
  const session = await auth();
  ensureSuperAdmin(session);

  const title = requireTrimmedString(formData.get("title"), "Title");
  const code = requireTrimmedString(formData.get("code"), "Code").toUpperCase();
  const description = optionalTrimmedString(formData.get("description"));
  const classType = parseClassType(formData.get("classType"));
  const active = formData.get("active") === "on";
  const requirement = parseRequirementFromFormData(formData);

  const createInput: Prisma.ClassCatalogCreateInput = {
    title,
    code,
    description,
    classType,
    active,
    requirements: requirement
      ? {
          create: requirement,
        }
      : undefined,
  };

  await prisma.classCatalog.create({
    data: createInput,
  });

  revalidatePath("/admin/catalog");
}

export async function updateMasterCatalogItem(formData: FormData) {
  const session = await auth();
  ensureSuperAdmin(session);

  const classCatalogId = requireTrimmedString(formData.get("classCatalogId"), "Catalog item");
  const title = requireTrimmedString(formData.get("title"), "Title");
  const code = requireTrimmedString(formData.get("code"), "Code").toUpperCase();
  const description = optionalTrimmedString(formData.get("description"));
  const classType = parseClassType(formData.get("classType"));
  const activeValue = formData.get("active");
  const active = activeValue === "true" || activeValue === "on";
  const requirement = parseRequirementFromFormData(formData);

  await prisma.$transaction(async (tx) => {
    await tx.classCatalog.update({
      where: {
        id: classCatalogId,
      },
      data: {
        title,
        code,
        description,
        classType,
        active,
      },
    });

    await tx.classRequirement.deleteMany({
      where: {
        classCatalogId,
      },
    });

    if (requirement) {
      await tx.classRequirement.create({
        data: {
          classCatalogId,
          ...requirement,
        },
      });
    }
  });

  revalidatePath("/admin/catalog");
}

export async function getAdminEventRegistrations(eventId: string) {
  const session = await auth();
  ensureSuperAdmin(session);

  const event = await prisma.event.findUnique({
    where: {
      id: eventId,
    },
    include: {
      registrations: {
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
        include: {
          club: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          attendees: {
            include: {
              rosterMember: {
                include: {
                  clubRosterYear: {
                    include: {
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
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      },
    },
  });

  return event;
}

function escapeCsvCell(value: string) {
  if (value.includes(",") || value.includes("\n") || value.includes('"')) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

export async function getMasterEventAttendeesCsv(eventId: string) {
  const session = await auth();
  ensureSuperAdmin(session);

  const event = await getAdminEventRegistrations(eventId);

  if (!event) {
    throw new Error("Event not found.");
  }

  const rows = event.registrations.flatMap((registration) =>
    registration.attendees.map((attendee) => {
      const member = attendee.rosterMember;
      const club = member.clubRosterYear.club;

      return [
        event.name,
        registration.registrationCode,
        registration.status,
        club.name,
        club.code,
        `${member.firstName} ${member.lastName}`,
        member.memberRole,
        member.ageAtStart?.toString() ?? "",
      ];
    }),
  );

  const header = [
    "Event",
    "Registration Code",
    "Registration Status",
    "Club",
    "Club Code",
    "Attendee",
    "Member Role",
    "Age At Start",
  ];

  const lines = [header, ...rows].map((row) => row.map((cell) => escapeCsvCell(cell)).join(","));

  return {
    fileName: `${event.slug}-master-attendees.csv`,
    content: lines.join("\n"),
  };
}
