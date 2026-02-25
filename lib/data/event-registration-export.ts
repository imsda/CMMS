import { prisma } from "../prisma";

export type EventRegistrationExportData = Awaited<ReturnType<typeof getEventRegistrationExportData>>;

export async function getEventRegistrationExportData(eventId: string, clubId: string) {
  return prisma.eventRegistration.findUnique({
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
                  eventClassOffering: {
                    eventId,
                  },
                },
                include: {
                  eventClassOffering: {
                    include: {
                      classCatalog: true,
                    },
                  },
                },
                orderBy: {
                  enrolledAt: "asc",
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
          eventFormField: true,
        },
        orderBy: [
          {
            eventFormField: {
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
}
