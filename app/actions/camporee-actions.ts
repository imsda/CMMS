"use server";

import { RegistrationStatus, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "../../auth";
import { getManagedClubContext } from "../../lib/club-management";
import { getCamporeeDashboardSnapshot } from "../../lib/data/camporee";
import { readManagedClubId } from "../../lib/director-path";
import { prisma } from "../../lib/prisma";

function requireTrimmedString(value: FormDataEntryValue | null, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required.`);
  }

  return value.trim();
}

function requireScore(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("Score is required.");
  }

  const parsed = Number.parseFloat(value);

  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error("Score must be a valid non-negative number.");
  }

  return parsed;
}

async function requireSuperAdminUserId() {
  const session = await auth();

  if (!session?.user || session.user.role !== UserRole.SUPER_ADMIN) {
    throw new Error("Only super admins can manage Camporee scoring.");
  }

  return session.user.id;
}

export async function getCamporeeDashboardData(eventId: string) {
  await requireSuperAdminUserId();
  return getCamporeeDashboardSnapshot(eventId);
}

export async function saveCamporeeScore(formData: FormData) {
  const createdByUserId = await requireSuperAdminUserId();
  const eventId = requireTrimmedString(formData.get("eventId"), "Event");
  const registrationId = requireTrimmedString(formData.get("registrationId"), "Registration");
  const category = requireTrimmedString(formData.get("category"), "Category");
  const score = requireScore(formData.get("score"));
  const notesValue = formData.get("notes");
  const notes = typeof notesValue === "string" && notesValue.trim().length > 0 ? notesValue.trim() : null;

  const registration = await prisma.eventRegistration.findUnique({
    where: {
      id: registrationId,
    },
    select: {
      id: true,
      eventId: true,
      clubId: true,
      status: true,
    },
  });

  if (!registration || registration.eventId !== eventId) {
    throw new Error("Registration not found for this event.");
  }

  if (
    registration.status !== RegistrationStatus.SUBMITTED &&
    registration.status !== RegistrationStatus.APPROVED
  ) {
    throw new Error("Camporee scores can only be saved for submitted or approved registrations.");
  }

  await prisma.camporeeScore.upsert({
    where: {
      eventRegistrationId_category: {
        eventRegistrationId: registrationId,
        category,
      },
    },
    update: {
      score,
      notes,
      createdByUserId,
      eventId,
    },
    create: {
      eventId,
      eventRegistrationId: registrationId,
      category,
      score,
      notes,
      createdByUserId,
    },
  });

  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath(`/admin/events/${eventId}/camporee`);
  revalidatePath(`/director/events/${eventId}`);
}

export async function assignCampsite(registrationId: string, campsiteLabel: string) {
  await requireSuperAdminUserId();

  const label = campsiteLabel.trim();

  const registration = await prisma.eventRegistration.findUnique({
    where: { id: registrationId },
    select: { id: true, eventId: true },
  });

  if (!registration) {
    throw new Error("Registration not found.");
  }

  await prisma.eventRegistration.update({
    where: { id: registrationId },
    data: { campsiteAssignment: label.length > 0 ? label : null },
  });

  revalidatePath(`/admin/events/${registration.eventId}/camporee`);
}

export async function getDirectorCamporeeSummary(eventId: string, clubIdOverride?: string | null) {
  const managedClub = await getManagedClubContext(clubIdOverride);

  const registration = await prisma.eventRegistration.findUnique({
    where: {
      eventId_clubId: {
        eventId,
        clubId: managedClub.clubId,
      },
    },
    select: {
      id: true,
      registrationCode: true,
      status: true,
      camporeeScores: {
        orderBy: [{ category: "asc" }, { createdAt: "asc" }],
        select: {
          category: true,
          score: true,
          notes: true,
        },
      },
    },
  });

  if (!registration) {
    return null;
  }

  return {
    registrationId: registration.id,
    registrationCode: registration.registrationCode,
    status: registration.status,
    scores: registration.camporeeScores,
    totalScore: registration.camporeeScores.reduce((total, score) => total + score.score, 0),
  };
}
