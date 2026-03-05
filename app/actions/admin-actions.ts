"use server";

import { ClassType, MemberRole, RequirementType, type Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type Session } from "next-auth";

import { auth } from "../../auth";
import { prisma } from "../../lib/prisma";

type RequirementConfig = {
  minAge?: number;
  maxAge?: number;
  requiredMemberRole?: MemberRole;
  requiredHonorCode?: string;
  requiredMasterGuide?: boolean;
};

type ParsedRequirementInput = {
  requirementType: RequirementType;
  config: RequirementConfig;
};

type RequirementDisplay = {
  requirementType: RequirementType;
  minAge: number | null;
  maxAge: number | null;
  requiredMemberRole: MemberRole | null;
  requiredHonorCode: string | null;
  requiredMasterGuide: boolean | null;
};

function ensureSuperAdmin(session: Session | null) {
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    throw new Error("Only super admins can perform this action.");
  }
}

function isRedirectError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

function parseOptionalNonNegativeInt(value: FormDataEntryValue | null, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative whole number.`);
  }

  return parsed;
}

function redirectEventClassOfferingAction(
  eventId: string,
  status: "success" | "error",
  message: string,
) {
  const query = new URLSearchParams({
    actionStatus: status,
    actionMessage: message,
  });

  redirect(`/admin/events/${eventId}/classes?${query.toString()}`);
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

  const minAge = parseOptionalInt(formData.get("minAge"), "Minimum age");
  const maxAge = parseOptionalInt(formData.get("maxAge"), "Maximum age");
  const requiredMemberRole = parseOptionalMemberRole(formData.get("requiredMemberRole"));
  const requiredHonorCode = optionalTrimmedString(formData.get("requiredHonorCode"));
  const requiredMasterGuide = parseOptionalBoolean(formData.get("requiredMasterGuide"));

  const config: RequirementConfig = {};

  if (requirementType === RequirementType.MIN_AGE && minAge !== null) {
    config.minAge = minAge;
  }

  if (requirementType === RequirementType.MAX_AGE && maxAge !== null) {
    config.maxAge = maxAge;
  }

  if (requirementType === RequirementType.MEMBER_ROLE && requiredMemberRole) {
    config.requiredMemberRole = requiredMemberRole;
  }

  if (requirementType === RequirementType.COMPLETED_HONOR && requiredHonorCode) {
    config.requiredHonorCode = requiredHonorCode;
  }

  if (requirementType === RequirementType.MASTER_GUIDE && requiredMasterGuide !== null) {
    config.requiredMasterGuide = requiredMasterGuide;
  }

  return {
    requirementType,
    config,
  };
}

function parseRequirementConfig(config: Prisma.JsonValue): RequirementConfig {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return {};
  }

  const raw = config as Record<string, unknown>;

  return {
    minAge: typeof raw.minAge === "number" ? raw.minAge : undefined,
    maxAge: typeof raw.maxAge === "number" ? raw.maxAge : undefined,
    requiredMemberRole:
      typeof raw.requiredMemberRole === "string" &&
      Object.values(MemberRole).includes(raw.requiredMemberRole as MemberRole)
        ? (raw.requiredMemberRole as MemberRole)
        : undefined,
    requiredHonorCode: typeof raw.requiredHonorCode === "string" ? raw.requiredHonorCode : undefined,
    requiredMasterGuide: typeof raw.requiredMasterGuide === "boolean" ? raw.requiredMasterGuide : undefined,
  };
}

function toRequirementDisplay(requirementType: RequirementType, config: Prisma.JsonValue): RequirementDisplay {
  const parsed = parseRequirementConfig(config);

  return {
    requirementType,
    minAge: parsed.minAge ?? null,
    maxAge: parsed.maxAge ?? null,
    requiredMemberRole: parsed.requiredMemberRole ?? null,
    requiredHonorCode: parsed.requiredHonorCode ?? null,
    requiredMasterGuide: parsed.requiredMasterGuide ?? null,
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

export async function getAdminEventsIndexData() {
  const session = await auth();
  ensureSuperAdmin(session);

  const now = new Date();

  return prisma.event.findMany({
    orderBy: {
      startsAt: "desc",
    },
    select: {
      id: true,
      name: true,
      slug: true,
      startsAt: true,
      endsAt: true,
      registrationOpensAt: true,
      registrationClosesAt: true,
      locationName: true,
      _count: {
        select: {
          registrations: true,
        },
      },
    },
  }).then((events) =>
    events.map((event) => ({
      ...event,
      registrationWindowStatus:
        now < event.registrationOpensAt
          ? "UPCOMING"
          : now > event.registrationClosesAt
            ? "CLOSED"
            : "OPEN",
      eventStatus: now > event.endsAt ? "PAST" : "ACTIVE",
    })),
  );
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

  return catalog.map((item) => ({
    ...item,
    requirements: item.requirements.map((requirement) => ({
      ...requirement,
      ...toRequirementDisplay(requirement.requirementType, requirement.config),
    })),
  }));
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
          create: {
            requirementType: requirement.requirementType,
            config: requirement.config,
          },
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
          requirementType: requirement.requirementType,
          config: requirement.config,
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

export async function createEventClassOfferingAction(formData: FormData) {
  const session = await auth();
  ensureSuperAdmin(session);

  const eventId = requireTrimmedString(formData.get("eventId"), "Event");
  const classCatalogId = requireTrimmedString(formData.get("classCatalogId"), "Catalog item");
  const teacherUserId = optionalTrimmedString(formData.get("teacherUserId"));
  const capacity = parseOptionalNonNegativeInt(formData.get("capacity"), "Capacity");

  try {
    await prisma.eventClassOffering.create({
      data: {
        eventId,
        classCatalogId,
        teacherUserId,
        capacity,
      },
    });

    revalidatePath(`/admin/events/${eventId}/classes`);
    revalidatePath(`/admin/events/${eventId}`);
    revalidatePath(`/director/events/${eventId}/classes`);
    revalidatePath("/teacher/dashboard");

    redirectEventClassOfferingAction(eventId, "success", "Class offering created.");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      redirectEventClassOfferingAction(eventId, "error", "That class is already assigned to this event.");
    }

    const message = error instanceof Error ? error.message : "Unable to create class offering.";
    redirectEventClassOfferingAction(eventId, "error", message);
  }
}

export async function updateEventClassOfferingAction(formData: FormData) {
  const session = await auth();
  ensureSuperAdmin(session);

  const eventId = requireTrimmedString(formData.get("eventId"), "Event");
  const offeringId = requireTrimmedString(formData.get("offeringId"), "Offering");
  const teacherUserId = optionalTrimmedString(formData.get("teacherUserId"));
  const capacity = parseOptionalNonNegativeInt(formData.get("capacity"), "Capacity");

  try {
    await prisma.eventClassOffering.update({
      where: {
        id: offeringId,
      },
      data: {
        teacherUserId,
        capacity,
      },
    });

    revalidatePath(`/admin/events/${eventId}/classes`);
    revalidatePath(`/admin/events/${eventId}`);
    revalidatePath(`/director/events/${eventId}/classes`);
    revalidatePath("/teacher/dashboard");

    redirectEventClassOfferingAction(eventId, "success", "Class offering updated.");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Unable to update class offering.";
    redirectEventClassOfferingAction(eventId, "error", message);
  }
}

export async function removeEventClassOfferingAction(formData: FormData) {
  const session = await auth();
  ensureSuperAdmin(session);

  const eventId = requireTrimmedString(formData.get("eventId"), "Event");
  const offeringId = requireTrimmedString(formData.get("offeringId"), "Offering");

  try {
    const enrollmentCount = await prisma.classEnrollment.count({
      where: {
        eventClassOfferingId: offeringId,
      },
    });

    if (enrollmentCount > 0) {
      redirectEventClassOfferingAction(
        eventId,
        "error",
        "Cannot remove class offering with active enrollments. Unenroll attendees first.",
      );
    }

    await prisma.eventClassOffering.delete({
      where: {
        id: offeringId,
      },
    });

    revalidatePath(`/admin/events/${eventId}/classes`);
    revalidatePath(`/admin/events/${eventId}`);
    revalidatePath(`/director/events/${eventId}/classes`);
    revalidatePath("/teacher/dashboard");

    redirectEventClassOfferingAction(eventId, "success", "Class offering removed.");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Unable to remove class offering.";
    redirectEventClassOfferingAction(eventId, "error", message);
  }
}

type PatchOrderRow = {
  honorName: string;
  honorCode: string;
  totalCountNeeded: number;
};

function readHonorCodeFromMetadata(metadata: Prisma.JsonValue): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = (metadata as Record<string, unknown>).honorCode;
  return typeof value === "string" && value.trim().length > 0 ? value.trim().toUpperCase() : null;
}

export async function getEventPatchOrderReport(eventId: string) {
  const session = await auth();
  ensureSuperAdmin(session);

  const event = await prisma.event.findUnique({
    where: {
      id: eventId,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      startsAt: true,
      endsAt: true,
    },
  });

  if (!event) {
    return null;
  }

  const completions = await prisma.memberRequirement.findMany({
    where: {
      requirementType: RequirementType.COMPLETED_HONOR,
      completedAt: {
        gte: event.startsAt,
        lte: event.endsAt,
      },
    },
    select: {
      metadata: true,
    },
  });

  const completionCountsByHonorCode = new Map<string, number>();

  for (const completion of completions) {
    const honorCode = readHonorCodeFromMetadata(completion.metadata);

    if (!honorCode) {
      continue;
    }

    completionCountsByHonorCode.set(honorCode, (completionCountsByHonorCode.get(honorCode) ?? 0) + 1);
  }

  const honorCodes = Array.from(completionCountsByHonorCode.keys());

  const honors = await prisma.classCatalog.findMany({
    where: {
      classType: ClassType.HONOR,
      code: {
        in: honorCodes,
      },
    },
    select: {
      code: true,
      title: true,
    },
  });

  const honorTitleByCode = new Map(honors.map((honor) => [honor.code, honor.title]));

  const rows: PatchOrderRow[] = honorCodes
    .sort((a, b) => a.localeCompare(b))
    .map((honorCode) => ({
      honorName: honorTitleByCode.get(honorCode) ?? "Unknown Honor",
      honorCode,
      totalCountNeeded: completionCountsByHonorCode.get(honorCode) ?? 0,
    }));

  return {
    event,
    rows,
  };
}

export async function getEventPatchOrderCsv(eventId: string) {
  const report = await getEventPatchOrderReport(eventId);

  if (!report) {
    throw new Error("Event not found.");
  }

  const header = ["Honor Name", "Honor Code", "Total Count Needed"];

  const rows = report.rows.map((row) => [
    row.honorName,
    row.honorCode,
    row.totalCountNeeded.toString(),
  ]);

  const lines = [header, ...rows].map((row) => row.map((cell) => escapeCsvCell(cell)).join(","));

  return {
    fileName: `${report.event.slug}-patch-order-report.csv`,
    content: lines.join("\n"),
  };
}
