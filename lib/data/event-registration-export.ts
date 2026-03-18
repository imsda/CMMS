import { decryptMedicalFields } from "../medical-data";
import { prisma } from "../prisma";

export type EventRegistrationExportData = Awaited<ReturnType<typeof getEventRegistrationExportData>>;

async function fetchRegistrationForExport(where: { eventId_clubId: { eventId: string; clubId: string } } | { id: string }, eventId: string) {
  const registration = await prisma.eventRegistration.findUnique({
    where,
    include: {
      club: {
        include: {
          memberships: {
            where: { isPrimary: true },
            include: {
              user: {
                select: { name: true, email: true },
              },
            },
            take: 1,
          },
        },
      },
      event: true,
      camporeeRegistration: true,
      attendees: {
        include: {
          rosterMember: {
            include: {
              classEnrollments: {
                where: {
                  offering: {
                    eventId,
                  },
                },
                include: {
                  offering: {
                    include: {
                      classCatalog: true,
                    },
                  },
                },
                orderBy: {
                  assignedAt: "asc",
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      formResponses: {
        include: {
          field: true,
        },
        orderBy: [
          {
            field: {
              sortOrder: "asc",
            },
          },
          {
            createdAt: "asc",
          },
        ],
      },
    },
  });

  if (!registration) {
    return null;
  }

  return {
    ...registration,
    attendees: registration.attendees.map((attendee) => ({
      ...attendee,
      rosterMember: decryptMedicalFields(attendee.rosterMember),
    })),
  };
}

export async function getEventRegistrationExportData(eventId: string, clubId: string) {
  return fetchRegistrationForExport({ eventId_clubId: { eventId, clubId } }, eventId);
}

export async function getEventRegistrationExportDataById(registrationId: string) {
  // First, look up the eventId so we can filter class enrollments correctly
  const stub = await prisma.eventRegistration.findUnique({
    where: { id: registrationId },
    select: { eventId: true },
  });

  if (!stub) {
    return null;
  }

  return fetchRegistrationForExport({ id: registrationId }, stub.eventId);
}
