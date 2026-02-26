"use server";

import {
  Gender,
  MemberRole,
  RolloverStatus,
  type Prisma,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "../../auth";
import { prisma } from "../../lib/prisma";

function parseOptionalNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseOptionalString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function getDirectorClubId() {
  const session = await auth();

  if (!session?.user || session.user.role !== "CLUB_DIRECTOR") {
    throw new Error("Only club directors can manage rosters.");
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

export async function saveRosterMember(formData: FormData) {
  const clubId = await getDirectorClubId();

  const rosterYearIdEntry = formData.get("clubRosterYearId");
  const memberIdEntry = formData.get("memberId");

  if (typeof rosterYearIdEntry !== "string" || rosterYearIdEntry.length === 0) {
    throw new Error("A roster year is required.");
  }

  const rosterYear = await prisma.clubRosterYear.findFirst({
    where: {
      id: rosterYearIdEntry,
      clubId,
    },
    select: {
      id: true,
    },
  });

  if (!rosterYear) {
    throw new Error("Roster year not found for this club.");
  }

  const firstNameEntry = formData.get("firstName");
  const lastNameEntry = formData.get("lastName");
  const memberRoleEntry = formData.get("memberRole");
  const genderEntry = formData.get("gender");

  if (typeof firstNameEntry !== "string" || firstNameEntry.trim().length === 0) {
    throw new Error("First name is required.");
  }

  if (typeof lastNameEntry !== "string" || lastNameEntry.trim().length === 0) {
    throw new Error("Last name is required.");
  }

  if (typeof memberRoleEntry !== "string" || !(memberRoleEntry in MemberRole)) {
    throw new Error("Member role is required.");
  }

  const genderValue =
    typeof genderEntry === "string" && genderEntry.length > 0 && genderEntry in Gender
      ? (genderEntry as Gender)
      : null;

  const ageAtStartValue = parseOptionalNumber(formData.get("ageAtStart"));
  const dateOfBirthRaw = parseOptionalString(formData.get("dateOfBirth"));

  const payload: Prisma.RosterMemberUncheckedCreateInput = {
    clubRosterYearId: rosterYear.id,
    firstName: firstNameEntry.trim(),
    lastName: lastNameEntry.trim(),
    memberRole: memberRoleEntry as MemberRole,
    ageAtStart: ageAtStartValue,
    dateOfBirth: dateOfBirthRaw ? new Date(`${dateOfBirthRaw}T00:00:00.000Z`) : null,
    gender: genderValue,
    medicalFlags: parseOptionalString(formData.get("medicalFlags")),
    dietaryRestrictions: parseOptionalString(formData.get("dietaryRestrictions")),
    isFirstTime: formData.get("isFirstTime") === "on",
    isMedicalPersonnel: formData.get("isMedicalPersonnel") === "on",
    masterGuide: formData.get("masterGuide") === "on",
    emergencyContactName: parseOptionalString(formData.get("emergencyContactName")),
    emergencyContactPhone: parseOptionalString(formData.get("emergencyContactPhone")),
    isActive: formData.get("isActive") === "on",
    rolloverStatus: RolloverStatus.NEW,
  };

  if (typeof memberIdEntry === "string" && memberIdEntry.length > 0) {
    const existingMember = await prisma.rosterMember.findFirst({
      where: {
        id: memberIdEntry,
        clubRosterYear: {
          clubId,
        },
      },
      select: {
        id: true,
      },
    });

    if (!existingMember) {
      throw new Error("Roster member not found for this club.");
    }

    const updatePayload: Prisma.RosterMemberUncheckedUpdateInput = {
      firstName: payload.firstName,
      lastName: payload.lastName,
      memberRole: payload.memberRole,
      ageAtStart: payload.ageAtStart,
      dateOfBirth: payload.dateOfBirth,
      gender: payload.gender,
      medicalFlags: payload.medicalFlags,
      dietaryRestrictions: payload.dietaryRestrictions,
      isFirstTime: payload.isFirstTime,
      isMedicalPersonnel: payload.isMedicalPersonnel,
      masterGuide: payload.masterGuide,
      emergencyContactName: payload.emergencyContactName,
      emergencyContactPhone: payload.emergencyContactPhone,
      isActive: payload.isActive,
    };

    await prisma.rosterMember.update({
      where: {
        id: existingMember.id,
      },
      data: updatePayload,
    });
  } else {
    await prisma.rosterMember.create({
      data: payload,
    });
  }

  revalidatePath("/director/roster");
  redirect("/director/roster");
}

export async function executeYearlyRollover(
  clubId: string,
  previousYearId: string,
  newYearLabel: string,
) {
  const directorClubId = await getDirectorClubId();

  if (directorClubId !== clubId) {
    throw new Error("You can only rollover the roster for your own club.");
  }

  const label = newYearLabel.trim();

  if (label.length === 0) {
    throw new Error("A year label is required.");
  }

  const yearAsNumber = Number(label);
  const safeYear = Number.isNaN(yearAsNumber) ? new Date().getFullYear() : yearAsNumber;

  await prisma.$transaction(async (tx) => {
    const previousYear = await tx.clubRosterYear.findFirst({
      where: {
        id: previousYearId,
        clubId,
      },
      select: {
        id: true,
      },
    });

    if (!previousYear) {
      throw new Error("Previous roster year not found.");
    }

    const existingYear = await tx.clubRosterYear.findUnique({
      where: {
        clubId_yearLabel: {
          clubId,
          yearLabel: label,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingYear) {
      throw new Error("A roster year with this label already exists.");
    }

    await tx.clubRosterYear.updateMany({
      where: {
        clubId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    const newYear = await tx.clubRosterYear.create({
      data: {
        clubId,
        yearLabel: label,
        startsOn: new Date(Date.UTC(safeYear, 0, 1, 0, 0, 0)),
        endsOn: new Date(Date.UTC(safeYear, 11, 31, 23, 59, 59)),
        copiedFromYearId: previousYear.id,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    const activeMembers = await tx.rosterMember.findMany({
      where: {
        clubRosterYearId: previousYear.id,
        isActive: true,
      },
    });

    if (activeMembers.length > 0) {
      await tx.rosterMember.createMany({
        data: activeMembers.map((member) => ({
          clubRosterYearId: newYear.id,
          firstName: member.firstName,
          lastName: member.lastName,
          dateOfBirth: member.dateOfBirth,
          ageAtStart: member.ageAtStart,
          gender: member.gender,
          memberRole: member.memberRole,
          medicalFlags: member.medicalFlags,
          dietaryRestrictions: member.dietaryRestrictions,
          isFirstTime: member.isFirstTime,
          isMedicalPersonnel: member.isMedicalPersonnel,
          masterGuide: member.masterGuide,
          emergencyContactName: member.emergencyContactName,
          emergencyContactPhone: member.emergencyContactPhone,
          isActive: true,
          rolloverStatus: RolloverStatus.CONTINUING,
        })),
      });
    }
  });

  revalidatePath("/director/roster");
  redirect("/director/roster");
}
