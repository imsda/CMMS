import { decryptMedicalFields } from "../medical-data";
import { prisma } from "../prisma";

export type EventRegistrationExportData = Awaited<ReturnType<typeof getEventRegistrationExportData>>;

export async function getEventRegistrationExportData(eventId: string, clubId: string) {
  const registration = await prisma.eventRegistration.findUnique({
    where: {
      eventId_clubId: {
        eventId,
        clubId,
      },
    },
    include: {
      club: true,
      event: true,
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
