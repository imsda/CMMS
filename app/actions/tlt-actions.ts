"use server";

import { MemberRole, TltApplicationStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "../../auth";
import { prisma } from "../../lib/prisma";

function parseRequiredString(value: FormDataEntryValue | null, fieldName: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is required.`);
  }

  return value.trim();
}

function parseRequiredInteger(value: FormDataEntryValue | null, fieldName: string) {
  const parsed = Number.parseInt(parseRequiredString(value, fieldName), 10);

  if (Number.isNaN(parsed)) {
    throw new Error(`${fieldName} must be a valid number.`);
  }

  return parsed;
}

async function getDirectorClubId() {
  const session = await auth();

  if (!session?.user || session.user.role !== "CLUB_DIRECTOR") {
    throw new Error("Only club directors can manage TLT applications.");
  }

  const membership = await prisma.clubMembership.findFirst({
    where: {
      userId: session.user.id,
    },
    select: {
      clubId: true,
    },
    orderBy: {
      isPrimary: "desc",
    },
  });

  if (!membership) {
    throw new Error("No club membership found for current user.");
  }

  return membership.clubId;
}

export async function saveTltApplication(formData: FormData) {
  const clubId = await getDirectorClubId();

  const rosterMemberId = parseRequiredString(formData.get("rosterMemberId"), "Roster member");

  const member = await prisma.rosterMember.findFirst({
    where: {
      id: rosterMemberId,
      memberRole: MemberRole.TLT,
      clubRosterYear: {
        clubId,
      },
    },
    select: {
      id: true,
    },
  });

  if (!member) {
    throw new Error("Selected roster member is not an eligible TLT from your club.");
  }

  const classesCompleted = formData
    .getAll("classesCompleted")
    .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    .map((entry) => entry.trim());

  if (classesCompleted.length === 0) {
    throw new Error("At least one completed class must be selected.");
  }

  const statusEntry = formData.get("status");
  const status =
    typeof statusEntry === "string" && statusEntry in TltApplicationStatus
      ? (statusEntry as TltApplicationStatus)
      : TltApplicationStatus.PENDING;

  await prisma.tltApplication.upsert({
    where: {
      rosterMemberId: member.id,
    },
    create: {
      rosterMemberId: member.id,
      clubId,
      grade: parseRequiredInteger(formData.get("grade"), "Grade"),
      citizenship: parseRequiredString(formData.get("citizenship"), "Citizenship"),
      isBaptized: formData.get("isBaptized") === "on",
      tltYearWorkingOn: parseRequiredInteger(formData.get("tltYearWorkingOn"), "TLT year working on"),
      schoolName: parseRequiredString(formData.get("schoolName"), "School name"),
      schoolAddress: parseRequiredString(formData.get("schoolAddress"), "School address"),
      classesCompleted,
      tShirtSize: parseRequiredString(formData.get("tShirtSize"), "T-shirt size"),
      poloSize: parseRequiredString(formData.get("poloSize"), "Polo size"),
      status,
    },
    update: {
      grade: parseRequiredInteger(formData.get("grade"), "Grade"),
      citizenship: parseRequiredString(formData.get("citizenship"), "Citizenship"),
      isBaptized: formData.get("isBaptized") === "on",
      tltYearWorkingOn: parseRequiredInteger(formData.get("tltYearWorkingOn"), "TLT year working on"),
      schoolName: parseRequiredString(formData.get("schoolName"), "School name"),
      schoolAddress: parseRequiredString(formData.get("schoolAddress"), "School address"),
      classesCompleted,
      tShirtSize: parseRequiredString(formData.get("tShirtSize"), "T-shirt size"),
      poloSize: parseRequiredString(formData.get("poloSize"), "Polo size"),
      status,
    },
  });

  revalidatePath("/director/tlt");
  revalidatePath(`/director/tlt/apply/${member.id}`);
  redirect("/director/tlt");
}
