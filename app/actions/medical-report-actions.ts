"use server";

import { MemberRole, RegistrationStatus } from "@prisma/client";

import { auth } from "../../auth";
import { prisma } from "../../lib/prisma";

export type MedicalManifestRow = {
  attendeeId: string;
  attendeeName: string;
  age: string;
  role: MemberRole;
  clubName: string;
  emergencyContactInfo: string;
  dietaryRestrictions: string | null;
  medicalFlags: string | null;
};

export type MedicalManifestData = {
  event: {
    id: string;
    name: string;
    startsAt: Date;
    endsAt: Date;
  };
  dietaryRows: MedicalManifestRow[];
  medicalRows: MedicalManifestRow[];
};

function ensureSuperAdmin(session: Awaited<ReturnType<typeof auth>>) {
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    throw new Error("Only super admins can access medical manifests.");
  }
}

function normalizeNullableText(value: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formatEmergencyContact(name: string | null, phone: string | null) {
  const trimmedName = normalizeNullableText(name);
  const trimmedPhone = normalizeNullableText(phone);

  if (trimmedName && trimmedPhone) {
    return `${trimmedName} (${trimmedPhone})`;
  }

  if (trimmedName) {
    return trimmedName;
  }

  if (trimmedPhone) {
    return trimmedPhone;
  }

  return "Not provided";
}

function formatAge(dateOfBirth: Date | null, ageAtStart: number | null) {
  if (typeof ageAtStart === "number") {
    return String(ageAtStart);
  }

  if (!dateOfBirth) {
    return "Unknown";
  }

  const now = new Date();
  let age = now.getFullYear() - dateOfBirth.getFullYear();
  const monthDifference = now.getMonth() - dateOfBirth.getMonth();

  if (monthDifference < 0 || (monthDifference === 0 && now.getDate() < dateOfBirth.getDate())) {
    age -= 1;
  }

  return String(Math.max(age, 0));
}

export async function getMedicalManifest(eventId: string): Promise<MedicalManifestData | null> {
  const session = await auth();
  ensureSuperAdmin(session);

  const event = await prisma.event.findUnique({
    where: {
      id: eventId,
    },
    select: {
      id: true,
      name: true,
      startsAt: true,
      endsAt: true,
    },
  });

  if (!event) {
    return null;
  }

  const attendees = await prisma.registrationAttendee.findMany({
    where: {
      eventRegistration: {
        eventId,
        status: {
          in: [RegistrationStatus.SUBMITTED, RegistrationStatus.APPROVED],
        },
      },
      rosterMember: {
        OR: [
          {
            medicalFlags: {
              not: null,
            },
          },
          {
            dietaryRestrictions: {
              not: null,
            },
          },
        ],
      },
    },
    select: {
      id: true,
      eventRegistration: {
        select: {
          club: {
            select: {
              name: true,
            },
          },
        },
      },
      rosterMember: {
        select: {
          firstName: true,
          lastName: true,
          dateOfBirth: true,
          ageAtStart: true,
          memberRole: true,
          dietaryRestrictions: true,
          medicalFlags: true,
          emergencyContactName: true,
          emergencyContactPhone: true,
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
    ],
  });

  const rows: MedicalManifestRow[] = attendees
    .map((attendee) => {
      const dietaryRestrictions = normalizeNullableText(attendee.rosterMember.dietaryRestrictions);
      const medicalFlags = normalizeNullableText(attendee.rosterMember.medicalFlags);

      if (!dietaryRestrictions && !medicalFlags) {
        return null;
      }

      return {
        attendeeId: attendee.id,
        attendeeName: `${attendee.rosterMember.firstName} ${attendee.rosterMember.lastName}`,
        age: formatAge(attendee.rosterMember.dateOfBirth, attendee.rosterMember.ageAtStart),
        role: attendee.rosterMember.memberRole,
        clubName: attendee.eventRegistration.club.name,
        emergencyContactInfo: formatEmergencyContact(
          attendee.rosterMember.emergencyContactName,
          attendee.rosterMember.emergencyContactPhone,
        ),
        dietaryRestrictions,
        medicalFlags,
      };
    })
    .filter((row): row is MedicalManifestRow => row !== null);

  const dietaryRows = rows.filter((row) => row.dietaryRestrictions !== null);
  const medicalRows = rows.filter((row) => row.medicalFlags !== null);

  return {
    event,
    dietaryRows,
    medicalRows,
  };
}
