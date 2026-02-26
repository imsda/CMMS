"use server";

import { revalidatePath } from "next/cache";

import { auth } from "../../auth";
import { prisma } from "../../lib/prisma";

type MarkAttendanceInput = {
  offeringId: string;
  rosterMemberId: string;
  attended: boolean;
};

type SignOffRequirementsInput = {
  offeringId: string;
  rosterMemberIds: string[];
  notes?: string;
};

async function assertTeacherAccessToOffering(offeringId: string) {
  const session = await auth();

  if (!session?.user || session.user.role !== "STAFF_TEACHER") {
    throw new Error("Only teaching staff can perform this action.");
  }

  const offering = await prisma.eventClassOffering.findFirst({
    where: {
      id: offeringId,
      instructorUserId: session.user.id,
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
    teacherUserId: session.user.id,
    offering,
  };
}

export async function updateClassAttendance(input: MarkAttendanceInput) {
  if (!input.offeringId || !input.rosterMemberId) {
    throw new Error("Class offering and roster member are required.");
  }

  const { offering } = await assertTeacherAccessToOffering(input.offeringId);

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

  const attendee = await prisma.registrationAttendee.findFirst({
    where: {
      rosterMemberId: input.rosterMemberId,
      eventRegistration: {
        eventId: offering.eventId,
      },
    },
    select: {
      id: true,
    },
  });

  if (!attendee) {
    throw new Error("Event attendee record was not found for this roster member.");
  }

  await prisma.registrationAttendee.update({
    where: {
      id: attendee.id,
    },
    data: {
      checkedInAt: input.attended ? new Date() : null,
    },
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

  const { offering, teacherUserId } = await assertTeacherAccessToOffering(input.offeringId);

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
      honorCode: offering.classCatalog.code,
      rosterMemberId: {
        in: selectedIds,
      },
    },
    select: {
      rosterMemberId: true,
    },
  });

  const completedIdSet = new Set(
    existingCompletions
      .map((item) => item.rosterMemberId)
      .filter((item): item is string => Boolean(item)),
  );

  const requirementsToCreate = selectedIds.filter((id) => !completedIdSet.has(id));

  if (requirementsToCreate.length > 0) {
    await prisma.memberRequirement.createMany({
      data: requirementsToCreate.map((rosterMemberId) => ({
        rosterMemberId,
        userId: teacherUserId,
        honorCode: offering.classCatalog.code,
        completedAt: new Date(),
        verifiedBy: "STAFF_TEACHER",
        notes: input.notes?.trim() || `Completed in class: ${offering.classCatalog.title}`,
      })),
    });
  }

  revalidatePath(`/teacher/class/${input.offeringId}`);
  revalidatePath("/teacher/dashboard");
}
