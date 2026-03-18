"use server";

import { ClassType, MemberRole, RequirementType, type Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type Session } from "next-auth";

import { auth } from "../../auth";
import { prisma } from "../../lib/prisma";
import { getSystemHealthSummary } from "../../lib/system-health";

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

function parseRequiredDateTime(value: FormDataEntryValue | null, label: string) {
  const raw = requireTrimmedString(value, label);
  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} must be a valid date/time.`);
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

function parseOptionalBooleanString(value: string | null, label: string) {
  if (value === null) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) {
    return null;
  }

  if (["true", "1", "yes", "y"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "n"].includes(normalized)) {
    return false;
  }

  throw new Error(`${label} must be true/false, yes/no, 1/0, or blank.`);
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

function parseCatalogCsvLine(line: string) {
  const columns: string[] = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      const nextCharacter = line[index + 1];

      if (inQuotes && nextCharacter === '"') {
        value += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }

      continue;
    }

    if (character === "," && !inQuotes) {
      columns.push(value.trim());
      value = "";
      continue;
    }

    value += character;
  }

  columns.push(value.trim());
  return columns;
}

function getCsvHeaderIndex(headers: string[], expected: string[]) {
  return headers.findIndex((header) => {
    const normalized = header.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    return expected.includes(normalized);
  });
}

type CatalogImportRow = {
  title: string;
  code: string;
  classType: ClassType;
  description: string | null;
  active: boolean;
  requirement: ParsedRequirementInput | null;
};

function parseCatalogImportCsv(csvText: string): CatalogImportRow[] {
  const normalized = csvText.replace(/^\uFEFF/, "");
  const rows = normalized
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter((row) => row.length > 0);

  if (rows.length < 2) {
    throw new Error("CSV must include a header row and at least one catalog row.");
  }

  const headers = parseCatalogCsvLine(rows[0]);
  const titleIndex = getCsvHeaderIndex(headers, ["title", "name"]);
  const codeIndex = getCsvHeaderIndex(headers, ["code", "honorcode", "catalogcode"]);
  const classTypeIndex = getCsvHeaderIndex(headers, ["classtype", "type"]);
  const descriptionIndex = getCsvHeaderIndex(headers, ["description", "details"]);
  const activeIndex = getCsvHeaderIndex(headers, ["active", "isactive"]);
  const requirementTypeIndex = getCsvHeaderIndex(headers, ["requirementtype"]);
  const minAgeIndex = getCsvHeaderIndex(headers, ["minage", "minimumage"]);
  const maxAgeIndex = getCsvHeaderIndex(headers, ["maxage", "maximumage"]);
  const requiredMemberRoleIndex = getCsvHeaderIndex(headers, ["requiredmemberrole", "memberrole"]);
  const requiredHonorCodeIndex = getCsvHeaderIndex(headers, ["requiredhonorcode", "prereqhonorcode"]);
  const requiredMasterGuideIndex = getCsvHeaderIndex(headers, ["requiredmasterguide", "masterguide"]);

  if (titleIndex === -1 || codeIndex === -1) {
    throw new Error("CSV headers must include Title and Code columns.");
  }

  return rows.slice(1).map((row, index) => {
    const columns = parseCatalogCsvLine(row);
    const title = columns[titleIndex]?.trim() ?? "";
    const code = (columns[codeIndex]?.trim() ?? "").toUpperCase();
    const classTypeRaw = classTypeIndex === -1 ? "HONOR" : columns[classTypeIndex]?.trim() ?? "HONOR";
    const description = descriptionIndex === -1 ? null : optionalTrimmedString(columns[descriptionIndex] ?? null);
    const activeRaw = activeIndex === -1 ? null : columns[activeIndex]?.trim() ?? null;
    const requirementTypeRaw =
      requirementTypeIndex === -1 ? null : columns[requirementTypeIndex]?.trim() ?? null;

    if (!title || !code) {
      throw new Error(`Row ${index + 2} must include both Title and Code.`);
    }

    if (!Object.values(ClassType).includes(classTypeRaw as ClassType)) {
      throw new Error(`Row ${index + 2} has an invalid Class Type.`);
    }

    const active = parseOptionalBooleanString(activeRaw, `Row ${index + 2} Active`) ?? true;
    const minAge =
      minAgeIndex === -1 ? null : parseOptionalInt(columns[minAgeIndex] ?? null, `Row ${index + 2} Minimum age`);
    const maxAge =
      maxAgeIndex === -1 ? null : parseOptionalInt(columns[maxAgeIndex] ?? null, `Row ${index + 2} Maximum age`);
    const requiredMemberRole =
      requiredMemberRoleIndex === -1 ? null : parseOptionalMemberRole(columns[requiredMemberRoleIndex] ?? null);
    const requiredHonorCode =
      requiredHonorCodeIndex === -1
        ? null
        : optionalTrimmedString(columns[requiredHonorCodeIndex] ?? null)?.toUpperCase() ?? null;
    const requiredMasterGuide =
      requiredMasterGuideIndex === -1
        ? null
        : parseOptionalBooleanString(columns[requiredMasterGuideIndex] ?? null, `Row ${index + 2} Master Guide`);

    let requirement: ParsedRequirementInput | null = null;

    if (requirementTypeRaw && requirementTypeRaw !== "NONE") {
      if (!Object.values(RequirementType).includes(requirementTypeRaw as RequirementType)) {
        throw new Error(`Row ${index + 2} has an invalid Requirement Type.`);
      }

      const requirementType = requirementTypeRaw as RequirementType;
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

      requirement = {
        requirementType,
        config,
      };
    }

    return {
      title,
      code,
      classType: classTypeRaw as ClassType,
      description,
      active,
      requirement,
    };
  });
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

  const [totalActiveClubs, totalConferenceMembers, upcomingEvents, systemHealth] = await Promise.all([
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
    getSystemHealthSummary(),
  ]);

  return {
    totalActiveClubs,
    totalConferenceMembers,
    upcomingEvents,
    systemHealth,
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
      eventMode: true,
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

export async function importMasterCatalogCsv(formData: FormData) {
  const session = await auth();
  ensureSuperAdmin(session);

  const file = formData.get("catalogCsv");

  if (!(file instanceof File)) {
    redirect("/admin/catalog?importStatus=error&importMessage=Please+choose+a+CSV+file.");
  }

  if (!file.name.toLowerCase().endsWith(".csv")) {
    redirect("/admin/catalog?importStatus=error&importMessage=Only+.csv+files+are+supported.");
  }

  try {
    const rows = parseCatalogImportCsv(await file.text());

    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        const item = await tx.classCatalog.upsert({
          where: {
            code: row.code,
          },
          update: {
            title: row.title,
            description: row.description,
            classType: row.classType,
            active: row.active,
          },
          create: {
            title: row.title,
            code: row.code,
            description: row.description,
            classType: row.classType,
            active: row.active,
          },
          select: {
            id: true,
          },
        });

        await tx.classRequirement.deleteMany({
          where: {
            classCatalogId: item.id,
          },
        });

        if (row.requirement) {
          await tx.classRequirement.create({
            data: {
              classCatalogId: item.id,
              requirementType: row.requirement.requirementType,
              config: row.requirement.config,
            },
          });
        }
      }
    });

    revalidatePath("/admin/catalog");
    redirect(`/admin/catalog?importStatus=success&importMessage=${encodeURIComponent(`Imported ${rows.length} catalog item(s).`)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Catalog import failed.";
    redirect(`/admin/catalog?importStatus=error&importMessage=${encodeURIComponent(message)}`);
  }
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
                          district: true,
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
        club.district ?? "",
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
    "District",
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
  const timeslotId = optionalTrimmedString(formData.get("timeslotId"));
  const teacherUserId = optionalTrimmedString(formData.get("teacherUserId"));
  const capacity = parseOptionalNonNegativeInt(formData.get("capacity"), "Capacity");
  const locationName = optionalTrimmedString(formData.get("locationName"));
  const active = formData.get("active") !== "off";

  try {
    await prisma.eventClassOffering.create({
      data: {
        eventId,
        timeslotId,
        classCatalogId,
        teacherUserId,
        capacity,
        locationName,
        active,
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
  const timeslotId = optionalTrimmedString(formData.get("timeslotId"));
  const teacherUserId = optionalTrimmedString(formData.get("teacherUserId"));
  const capacity = parseOptionalNonNegativeInt(formData.get("capacity"), "Capacity");
  const locationName = optionalTrimmedString(formData.get("locationName"));
  const active = formData.get("active") !== "off";

  try {
    const offering = await prisma.eventClassOffering.findUnique({
      where: {
        id: offeringId,
      },
      select: {
        id: true,
        _count: {
          select: {
            enrollments: true,
          },
        },
      },
    });

    if (!offering) {
      redirectEventClassOfferingAction(eventId, "error", "Class offering not found.");
    }

    if (typeof capacity === "number" && capacity < offering._count.enrollments) {
      redirectEventClassOfferingAction(
        eventId,
        "error",
        `Capacity cannot be lower than current enrollment (${offering._count.enrollments}).`,
      );
    }

    await prisma.eventClassOffering.update({
      where: {
        id: offeringId,
      },
      data: {
        timeslotId,
        teacherUserId,
        capacity,
        locationName,
        active,
      },
    });

    revalidatePath(`/admin/events/${eventId}/classes`);
    revalidatePath(`/admin/events/${eventId}`);
    revalidatePath(`/director/events/${eventId}/classes`);
    revalidatePath("/teacher/dashboard");
    revalidatePath(`/teacher/class/${offeringId}`);

    redirectEventClassOfferingAction(eventId, "success", "Class offering updated.");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Unable to update class offering.";
    redirectEventClassOfferingAction(eventId, "error", message);
  }
}

export async function createEventClassTimeslotAction(formData: FormData) {
  const session = await auth();
  ensureSuperAdmin(session);

  const eventId = requireTrimmedString(formData.get("eventId"), "Event");
  const label = requireTrimmedString(formData.get("label"), "Timeslot label");
  const startsAt = parseRequiredDateTime(formData.get("startsAt"), "Start time");
  const endsAt = parseRequiredDateTime(formData.get("endsAt"), "End time");
  const sortOrder = parseOptionalNonNegativeInt(formData.get("sortOrder"), "Sort order") ?? 0;
  const active = formData.get("active") !== "off";

  if (endsAt <= startsAt) {
    redirectEventClassOfferingAction(eventId, "error", "Timeslot end time must be after start time.");
  }

  try {
    await prisma.eventClassTimeslot.create({
      data: {
        eventId,
        label,
        startsAt,
        endsAt,
        sortOrder,
        active,
      },
    });

    revalidatePath(`/admin/events/${eventId}/classes`);
    redirectEventClassOfferingAction(eventId, "success", "Class timeslot created.");
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
      redirectEventClassOfferingAction(eventId, "error", "That timeslot label already exists for this event.");
    }

    const message = error instanceof Error ? error.message : "Unable to create class timeslot.";
    redirectEventClassOfferingAction(eventId, "error", message);
  }
}

export async function updateEventClassTimeslotAction(formData: FormData) {
  const session = await auth();
  ensureSuperAdmin(session);

  const eventId = requireTrimmedString(formData.get("eventId"), "Event");
  const timeslotId = requireTrimmedString(formData.get("timeslotId"), "Timeslot");
  const label = requireTrimmedString(formData.get("label"), "Timeslot label");
  const startsAt = parseRequiredDateTime(formData.get("startsAt"), "Start time");
  const endsAt = parseRequiredDateTime(formData.get("endsAt"), "End time");
  const sortOrder = parseOptionalNonNegativeInt(formData.get("sortOrder"), "Sort order") ?? 0;
  const active = formData.get("active") !== "off";

  if (endsAt <= startsAt) {
    redirectEventClassOfferingAction(eventId, "error", "Timeslot end time must be after start time.");
  }

  try {
    await prisma.eventClassTimeslot.update({
      where: {
        id: timeslotId,
      },
      data: {
        label,
        startsAt,
        endsAt,
        sortOrder,
        active,
      },
    });

    revalidatePath(`/admin/events/${eventId}/classes`);
    revalidatePath(`/director/events/${eventId}/classes`);
    redirectEventClassOfferingAction(eventId, "success", "Class timeslot updated.");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Unable to update class timeslot.";
    redirectEventClassOfferingAction(eventId, "error", message);
  }
}

export async function removeEventClassTimeslotAction(formData: FormData) {
  const session = await auth();
  ensureSuperAdmin(session);

  const eventId = requireTrimmedString(formData.get("eventId"), "Event");
  const timeslotId = requireTrimmedString(formData.get("timeslotId"), "Timeslot");

  try {
    const [offeringCount, preferenceCount, waitlistCount] = await Promise.all([
      prisma.eventClassOffering.count({
        where: {
          timeslotId,
        },
      }),
      prisma.eventClassPreference.count({
        where: {
          timeslotId,
        },
      }),
      prisma.eventClassWaitlist.count({
        where: {
          timeslotId,
        },
      }),
    ]);

    if (offeringCount > 0 || preferenceCount > 0 || waitlistCount > 0) {
      redirectEventClassOfferingAction(
        eventId,
        "error",
        "Cannot remove a timeslot with offerings, saved preferences, or waitlist entries. Move or clear them first.",
      );
    }

    await prisma.eventClassTimeslot.delete({
      where: {
        id: timeslotId,
      },
    });

    revalidatePath(`/admin/events/${eventId}/classes`);
    redirectEventClassOfferingAction(eventId, "success", "Class timeslot removed.");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Unable to remove class timeslot.";
    redirectEventClassOfferingAction(eventId, "error", message);
  }
}

export async function migrateLegacyEventClassOfferingsAction(formData: FormData) {
  const session = await auth();
  ensureSuperAdmin(session);

  const eventId = requireTrimmedString(formData.get("eventId"), "Event");
  const label = requireTrimmedString(formData.get("label"), "Timeslot label");
  const startsAt = parseRequiredDateTime(formData.get("startsAt"), "Start time");
  const endsAt = parseRequiredDateTime(formData.get("endsAt"), "End time");

  if (endsAt <= startsAt) {
    redirectEventClassOfferingAction(eventId, "error", "Timeslot end time must be after start time.");
  }

  try {
    const legacyOfferingCount = await prisma.eventClassOffering.count({
      where: {
        eventId,
        timeslotId: null,
      },
    });

    if (legacyOfferingCount === 0) {
      redirectEventClassOfferingAction(eventId, "error", "There are no legacy offerings left to migrate.");
    }

    await prisma.$transaction(async (tx) => {
      const sortOrderAggregate = await tx.eventClassTimeslot.aggregate({
        where: {
          eventId,
        },
        _max: {
          sortOrder: true,
        },
      });

      const timeslot = await tx.eventClassTimeslot.create({
        data: {
          eventId,
          label,
          startsAt,
          endsAt,
          sortOrder: (sortOrderAggregate._max.sortOrder ?? -1) + 1,
          active: false,
        },
      });

      await tx.eventClassOffering.updateMany({
        where: {
          eventId,
          timeslotId: null,
        },
        data: {
          timeslotId: timeslot.id,
        },
      });
    });

    revalidatePath(`/admin/events/${eventId}/classes`);
    revalidatePath(`/admin/events/${eventId}`);
    revalidatePath(`/director/events/${eventId}/classes`);
    revalidatePath("/teacher/dashboard");

    redirectEventClassOfferingAction(eventId, "success", "Legacy offerings were moved into a new inactive cleanup timeslot.");
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
      redirectEventClassOfferingAction(eventId, "error", "That timeslot label already exists for this event.");
    }

    const message = error instanceof Error ? error.message : "Unable to migrate legacy offerings.";
    redirectEventClassOfferingAction(eventId, "error", message);
  }
}

export async function removeEventClassOfferingAction(formData: FormData) {
  const session = await auth();
  ensureSuperAdmin(session);

  const eventId = requireTrimmedString(formData.get("eventId"), "Event");
  const offeringId = requireTrimmedString(formData.get("offeringId"), "Offering");

  try {
    const [enrollmentCount, waitlistCount] = await Promise.all([
      prisma.classEnrollment.count({
        where: {
          eventClassOfferingId: offeringId,
        },
      }),
      prisma.eventClassWaitlist.count({
        where: {
          eventClassOfferingId: offeringId,
        },
      }),
    ]);

    if (enrollmentCount > 0) {
      redirectEventClassOfferingAction(
        eventId,
        "error",
        "Cannot remove class offering with active enrollments. Unenroll attendees first.",
      );
    }

    if (waitlistCount > 0) {
      redirectEventClassOfferingAction(
        eventId,
        "error",
        "Cannot remove class offering with active waitlist entries. Clear the waitlist first.",
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
    revalidatePath(`/teacher/class/${offeringId}`);

    redirectEventClassOfferingAction(eventId, "success", "Class offering removed.");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Unable to remove class offering.";
    redirectEventClassOfferingAction(eventId, "error", message);
  }
}

export async function clearEventClassOfferingEnrollmentsAction(formData: FormData) {
  const session = await auth();
  ensureSuperAdmin(session);

  const eventId = requireTrimmedString(formData.get("eventId"), "Event");
  const offeringId = requireTrimmedString(formData.get("offeringId"), "Offering");

  try {
    const deleted = await prisma.classEnrollment.deleteMany({
      where: {
        eventClassOfferingId: offeringId,
        offering: {
          eventId,
        },
      },
    });

    revalidatePath(`/admin/events/${eventId}/classes`);
    revalidatePath(`/admin/events/${eventId}`);
    revalidatePath(`/director/events/${eventId}/classes`);
    revalidatePath("/teacher/dashboard");
    revalidatePath(`/teacher/class/${offeringId}`);

    if (deleted.count === 0) {
      redirectEventClassOfferingAction(eventId, "error", "No enrollments were found to clear.");
    }

    redirectEventClassOfferingAction(
      eventId,
      "success",
      `Cleared ${deleted.count} enrollment(s) from the class offering.`,
    );
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Unable to clear enrollments.";
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
