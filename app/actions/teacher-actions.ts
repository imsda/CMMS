"use server";

import { RequirementType, UserRole, type Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "../../auth";
import { buildClassAttendanceUpdate } from "../../lib/class-model";
import { prisma } from "../../lib/prisma";
import { requireTeacherPortalSession } from "../../lib/teacher-portal";

type MarkAttendanceInput = {
  offeringId: string;
  rosterMemberId: string;
  attended: boolean;
};

type BulkAttendanceInput = {
  offeringId: string;
  rosterMemberIds: string[];
  attended: boolean;
};

type SignOffRequirementsInput = {
  offeringId: string;
  rosterMemberIds: string[];
  notes?: string;
};

type CompletedHonorMetadata = {
  rosterMemberId: string;
  honorCode: string;
  classTitle: string;
  teacherUserId: string;
  eventClassOfferingId: string;
  notes?: string;
};

async function assertTeacherAccessToOffering(offeringId: string) {
  const session = await auth();
  const access = requireTeacherPortalSession(session);

  const offering = await prisma.eventClassOffering.findFirst({
    where: {
      id: offeringId,
      ...(access.isSuperAdmin
        ? {}
        : {
            teacherUserId: access.userId,
          }),
    },
    select: {
      id: true,
      eventId: true,
      classCatalog: {
        select: {
          code: true,
          title: true,
        },
      },
    },
  });

  if (!offering) {
    throw new Error("Class offering not found or not assigned to you.");
  }

  return {
    teacherUserId: access.userId,
    isSuperAdmin: access.isSuperAdmin,
    offering,
  };
}

function readCompletedHonorMetadata(metadata: Prisma.JsonValue): Partial<CompletedHonorMetadata> | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  return metadata as Partial<CompletedHonorMetadata>;
}

export async function updateClassAttendance(input: MarkAttendanceInput) {
  if (!input.offeringId || !input.rosterMemberId) {
    throw new Error("Class offering and roster member are required.");
  }

  await assertTeacherAccessToOffering(input.offeringId);
  await updateClassAttendanceForOfferingInternal(input);
  revalidatePath(`/teacher/class/${input.offeringId}`);
  revalidatePath("/teacher/dashboard");
}

async function updateClassAttendanceForOfferingInternal(input: MarkAttendanceInput) {
  if (!input.offeringId || !input.rosterMemberId) {
    throw new Error("Class offering and roster member are required.");
  }

  const enrollment = await prisma.classEnrollment.findUnique({
    where: {
      eventClassOfferingId_rosterMemberId: {
        eventClassOfferingId: input.offeringId,
        rosterMemberId: input.rosterMemberId,
      },
    },
    select: {
      id: true,
    },
  });

  if (!enrollment) {
    throw new Error("Roster member is not enrolled in this class.");
  }

  await prisma.classEnrollment.update({
    where: {
      id: enrollment.id,
    },
    data: buildClassAttendanceUpdate(input.attended),
  });
}

export async function bulkUpdateClassAttendance(input: BulkAttendanceInput) {
  if (!input.offeringId) {
    throw new Error("Class offering is required.");
  }

  const rosterMemberIds = Array.from(new Set(input.rosterMemberIds.filter((id) => id.trim().length > 0)));

  if (rosterMemberIds.length === 0) {
    throw new Error("Select at least one student.");
  }

  await assertTeacherAccessToOffering(input.offeringId);

  const enrollments = await prisma.classEnrollment.findMany({
    where: {
      eventClassOfferingId: input.offeringId,
      rosterMemberId: {
        in: rosterMemberIds,
      },
    },
    select: {
      id: true,
    },
  });

  if (enrollments.length !== rosterMemberIds.length) {
    throw new Error("One or more selected students are not enrolled in this class.");
  }

  await prisma.classEnrollment.updateMany({
    where: {
      id: {
        in: enrollments.map((enrollment) => enrollment.id),
      },
    },
    data: buildClassAttendanceUpdate(input.attended),
  });

  revalidatePath(`/teacher/class/${input.offeringId}`);
  revalidatePath("/teacher/dashboard");
}

export async function signOffRequirementsForStudents(input: SignOffRequirementsInput) {
  if (!input.offeringId) {
    throw new Error("Class offering is required.");
  }

  const selectedIds = Array.from(new Set(input.rosterMemberIds.filter((id) => id.trim().length > 0)));

  if (selectedIds.length === 0) {
    throw new Error("Select at least one student to sign off requirements.");
  }

  const { offering, teacherUserId, isSuperAdmin } = await assertTeacherAccessToOffering(input.offeringId);

  const enrollments = await prisma.classEnrollment.findMany({
    where: {
      eventClassOfferingId: input.offeringId,
      rosterMemberId: {
        in: selectedIds,
      },
    },
    select: {
      rosterMemberId: true,
    },
  });

  const enrolledIds = new Set(enrollments.map((enrollment) => enrollment.rosterMemberId));

  if (enrolledIds.size !== selectedIds.length) {
    throw new Error("One or more selected students are not enrolled in this class.");
  }

  const existingCompletions = await prisma.memberRequirement.findMany({
    where: {
      rosterMemberId: {
        in: selectedIds,
      },
      requirementType: RequirementType.COMPLETED_HONOR,
    },
    select: {
      rosterMemberId: true,
      metadata: true,
    },
  });

  const completedRosterMemberIdSet = new Set<string>();

  for (const completion of existingCompletions) {
    const metadata = readCompletedHonorMetadata(completion.metadata);

    if (!metadata) {
      continue;
    }

    const rosterMemberId =
      completion.rosterMemberId ??
      (typeof metadata.rosterMemberId === "string" ? metadata.rosterMemberId : null);

    if (!rosterMemberId) {
      continue;
    }

    if (typeof metadata.honorCode === "string" && metadata.honorCode.toUpperCase() === offering.classCatalog.code.toUpperCase()) {
      completedRosterMemberIdSet.add(rosterMemberId);
    }
  }

  const requirementsToCreate = selectedIds.filter((id) => !completedRosterMemberIdSet.has(id));

  if (requirementsToCreate.length > 0) {
    await prisma.memberRequirement.createMany({
      data: requirementsToCreate.map((rosterMemberId) => ({
        userId: teacherUserId,
        rosterMemberId,
        requirementType: RequirementType.COMPLETED_HONOR,
        completedAt: new Date(),
        metadata: {
          rosterMemberId,
          honorCode: offering.classCatalog.code,
          classTitle: offering.classCatalog.title,
          teacherUserId,
          eventClassOfferingId: input.offeringId,
          signedOffByRole: isSuperAdmin ? UserRole.SUPER_ADMIN : UserRole.STAFF_TEACHER,
          notes: input.notes?.trim() || `Completed in class: ${offering.classCatalog.title}`,
        },
      })),
    });
  }

  revalidatePath(`/teacher/class/${input.offeringId}`);
  revalidatePath("/teacher/dashboard");
}
