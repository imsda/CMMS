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
import { safeWriteAuditLog } from "../../lib/audit-log";
import { getManagedClubContext } from "../../lib/club-management";
import { buildDirectorPath, readManagedClubId } from "../../lib/director-path";
import { decryptMedicalFields, prepareMedicalFieldsForWrite } from "../../lib/medical-data";
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

async function getRosterManagementContext(clubIdOverride?: string | null) {
  return getManagedClubContext(clubIdOverride);
}

export async function saveRosterMember(formData: FormData) {
  const clubIdOverride = readManagedClubId(formData.get("clubId"));
  const managedClub = await getRosterManagementContext(clubIdOverride);
  const clubId = managedClub.clubId;

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
  const backgroundCheckDateRaw = parseOptionalString(formData.get("backgroundCheckDate"));
  const backgroundCheckDate = backgroundCheckDateRaw
    ? new Date(`${backgroundCheckDateRaw}T00:00:00.000Z`)
    : null;
  const lastTetanusDateRaw = parseOptionalString(formData.get("lastTetanusDate"));
  const medicalWriteFields = prepareMedicalFieldsForWrite({
    medicalFlags: parseOptionalString(formData.get("medicalFlags")),
    dietaryRestrictions: parseOptionalString(formData.get("dietaryRestrictions")),
    insuranceCompany: parseOptionalString(formData.get("insuranceCompany")),
    insurancePolicyNumber: parseOptionalString(formData.get("insurancePolicyNumber")),
    lastTetanusDate: lastTetanusDateRaw ? new Date(`${lastTetanusDateRaw}T00:00:00.000Z`) : null,
  });

  const photoReleaseConsent = formData.get("photoReleaseConsent") === "on";
  const medicalTreatmentConsent = formData.get("medicalTreatmentConsent") === "on";
  const membershipAgreementConsent = formData.get("membershipAgreementConsent") === "on";

  if (!photoReleaseConsent || !medicalTreatmentConsent || !membershipAgreementConsent) {
    throw new Error("All required consent agreements must be accepted.");
  }

  const payload: Prisma.RosterMemberUncheckedCreateInput = {
    clubRosterYearId: rosterYear.id,
    firstName: firstNameEntry.trim(),
    lastName: lastNameEntry.trim(),
    memberRole: memberRoleEntry as MemberRole,
    ageAtStart: ageAtStartValue,
    dateOfBirth: dateOfBirthRaw ? new Date(`${dateOfBirthRaw}T00:00:00.000Z`) : null,
    gender: genderValue,
    medicalFlags: medicalWriteFields.medicalFlags,
    dietaryRestrictions: medicalWriteFields.dietaryRestrictions,
    isFirstTime: formData.get("isFirstTime") === "on",
    isMedicalPersonnel: formData.get("isMedicalPersonnel") === "on",
    masterGuide: formData.get("masterGuide") === "on",
    backgroundCheckDate,
    backgroundCheckCleared: Boolean(backgroundCheckDate),
    swimTestCleared: formData.get("swimTestCleared") === "on",
    emergencyContactName: parseOptionalString(formData.get("emergencyContactName")),
    emergencyContactPhone: parseOptionalString(formData.get("emergencyContactPhone")),
    insuranceCompany: medicalWriteFields.insuranceCompany,
    insurancePolicyNumber: medicalWriteFields.insurancePolicyNumber,
    lastTetanusDate: medicalWriteFields.lastTetanusDate,
    lastTetanusDateEncrypted: medicalWriteFields.lastTetanusDateEncrypted,
    photoReleaseConsent,
    medicalTreatmentConsent,
    membershipAgreementConsent,
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
        backgroundCheckCleared: true,
        swimTestCleared: true,
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
      backgroundCheckDate: payload.backgroundCheckDate,
      // Only compliance sync should grant clearance. Director roster edits may log a date,
      // but they must not imply a cleared status on their own.
      backgroundCheckCleared: existingMember.backgroundCheckCleared,
      swimTestCleared: payload.swimTestCleared,
      emergencyContactName: payload.emergencyContactName,
      emergencyContactPhone: payload.emergencyContactPhone,
      insuranceCompany: payload.insuranceCompany,
      insurancePolicyNumber: payload.insurancePolicyNumber,
      lastTetanusDate: payload.lastTetanusDate,
      lastTetanusDateEncrypted: payload.lastTetanusDateEncrypted,
      photoReleaseConsent: payload.photoReleaseConsent,
      medicalTreatmentConsent: payload.medicalTreatmentConsent,
      membershipAgreementConsent: payload.membershipAgreementConsent,
      isActive: payload.isActive,
    };

    await prisma.rosterMember.update({
      where: {
        id: existingMember.id,
      },
      data: updatePayload,
    });

    await safeWriteAuditLog({
      actorUserId: managedClub.userId,
      action: "roster_member.update",
      targetType: "RosterMember",
      targetId: existingMember.id,
      clubId,
      clubRosterYearId: rosterYear.id,
      summary: `Updated roster member ${payload.firstName} ${payload.lastName}.`,
      metadata: {
        memberRole: payload.memberRole,
        isActive: payload.isActive,
      },
    });
  } else {
    const createdMember = await prisma.rosterMember.create({
      data: {
        ...payload,
        backgroundCheckCleared: false,
      },
    });

    await safeWriteAuditLog({
      actorUserId: managedClub.userId,
      action: "roster_member.create",
      targetType: "RosterMember",
      targetId: createdMember.id,
      clubId,
      clubRosterYearId: rosterYear.id,
      summary: `Created roster member ${payload.firstName} ${payload.lastName}.`,
      metadata: {
        memberRole: payload.memberRole,
        isActive: payload.isActive,
      },
    });
  }

  revalidatePath("/director/roster");
  redirect(buildDirectorPath("/director/roster", clubId, managedClub.isSuperAdmin));
}

export async function createRosterYear(newYearLabel: string, clubIdOverride?: string | null) {
  const managedClub = await getRosterManagementContext(clubIdOverride);
  const clubId = managedClub.clubId;
  const label = newYearLabel.trim();

  if (label.length === 0) {
    throw new Error("A year label is required.");
  }

  const yearAsNumber = Number(label);
  const safeYear = Number.isNaN(yearAsNumber) ? new Date().getFullYear() : yearAsNumber;

  await prisma.$transaction(async (tx) => {
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

    await tx.clubRosterYear.create({
      data: {
        clubId,
        yearLabel: label,
        startsOn: new Date(Date.UTC(safeYear, 0, 1, 0, 0, 0)),
        endsOn: new Date(Date.UTC(safeYear, 11, 31, 23, 59, 59)),
        isActive: true,
      },
      select: {
        id: true,
      },
    });
  });

  await safeWriteAuditLog({
    actorUserId: managedClub.userId,
    action: "roster_year.create",
    targetType: "ClubRosterYear",
    clubId,
    summary: `Created roster year ${label}.`,
    metadata: {
      yearLabel: label,
    },
  });

  revalidatePath("/director/roster");
  redirect(buildDirectorPath("/director/roster", clubId, managedClub.isSuperAdmin));
}

export async function executeYearlyRollover(
  clubId: string,
  previousYearId: string,
  newYearLabel: string,
  clubIdOverride?: string | null,
) {
  const managedClub = await getRosterManagementContext(clubIdOverride);
  const directorClubId = managedClub.clubId;

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
        data: activeMembers.map((member) => {
          const decryptedMember = decryptMedicalFields(member);
          const medicalWriteFields = prepareMedicalFieldsForWrite({
            medicalFlags: decryptedMember.medicalFlags,
            dietaryRestrictions: decryptedMember.dietaryRestrictions,
            insuranceCompany: decryptedMember.insuranceCompany,
            insurancePolicyNumber: decryptedMember.insurancePolicyNumber,
            lastTetanusDate: decryptedMember.lastTetanusDate,
          });

          return {
            clubRosterYearId: newYear.id,
            firstName: member.firstName,
            lastName: member.lastName,
            dateOfBirth: member.dateOfBirth,
            ageAtStart: member.ageAtStart,
            gender: member.gender,
            memberRole: member.memberRole,
            medicalFlags: medicalWriteFields.medicalFlags,
            dietaryRestrictions: medicalWriteFields.dietaryRestrictions,
            isFirstTime: member.isFirstTime,
            isMedicalPersonnel: member.isMedicalPersonnel,
            masterGuide: member.masterGuide,
            backgroundCheckDate: member.backgroundCheckDate,
            backgroundCheckCleared: member.backgroundCheckCleared,
            swimTestCleared: false,
            emergencyContactName: member.emergencyContactName,
            emergencyContactPhone: member.emergencyContactPhone,
            insuranceCompany: medicalWriteFields.insuranceCompany,
            insurancePolicyNumber: medicalWriteFields.insurancePolicyNumber,
            lastTetanusDate: medicalWriteFields.lastTetanusDate,
            lastTetanusDateEncrypted: medicalWriteFields.lastTetanusDateEncrypted,
            photoReleaseConsent: member.photoReleaseConsent,
            medicalTreatmentConsent: member.medicalTreatmentConsent,
            membershipAgreementConsent: member.membershipAgreementConsent,
            isActive: true,
            rolloverStatus: RolloverStatus.CONTINUING,
          };
        }),
      });
    }
  });

  await safeWriteAuditLog({
    actorUserId: managedClub.userId,
    action: "roster_year.rollover",
    targetType: "ClubRosterYear",
    clubId,
    targetId: previousYearId,
    summary: `Executed yearly rollover into ${label}.`,
    metadata: {
      previousYearId,
      newYearLabel: label,
    },
  });

  revalidatePath("/director/roster");
  redirect(buildDirectorPath("/director/roster", clubId, managedClub.isSuperAdmin));
}
