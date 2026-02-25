import { notFound } from "next/navigation";

import { auth } from "../../../../../auth";
import { prisma } from "../../../../../lib/prisma";
import { type RequirementInput } from "../../../../../lib/class-prerequisite-utils";
import { ClassAssignmentBoard } from "./_components/class-assignment-board";

function formatSlotLabel(dayIndex: number, startsAt: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return `Day ${dayIndex + 1} • ${formatter.format(startsAt)}`;
}

export default async function DirectorClassSelectionPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const session = await auth();

  if (!session?.user || session.user.role !== "CLUB_DIRECTOR") {
    throw new Error("Only club directors can manage class assignments.");
  }

  const { eventId } = await params;

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
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <h1 className="text-xl font-semibold">No club membership found</h1>
        <p className="mt-2 text-sm">You need an active club membership before assigning event classes.</p>
      </section>
    );
  }

  const registration = await prisma.eventRegistration.findFirst({
    where: {
      eventId,
      clubId: membership.clubId,
    },
    select: {
      event: {
        select: {
          id: true,
          name: true,
        },
      },
      attendees: {
        select: {
          rosterMember: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              ageAtStart: true,
              memberRole: true,
              masterGuide: true,
              completedRequirements: {
                select: {
                  honorCode: true,
                },
              },
              classEnrollments: {
                where: {
                  eventClassOffering: {
                    eventId,
                  },
                },
                select: {
                  eventClassOfferingId: true,
                },
              },
            },
          },
        },
        orderBy: {
          rosterMember: {
            lastName: "asc",
          },
        },
      },
    },
  });

  if (!registration) {
    notFound();
  }

  const offerings = await prisma.eventClassOffering.findMany({
    where: {
      eventId,
    },
    select: {
      id: true,
      dayIndex: true,
      startsAt: true,
      endsAt: true,
      capacity: true,
      location: true,
      classCatalog: {
        select: {
          title: true,
          code: true,
          requirements: {
            select: {
              requirementType: true,
              minAge: true,
              maxAge: true,
              requiredMemberRole: true,
              requiredHonorCode: true,
              requiredMasterGuide: true,
            },
          },
        },
      },
      _count: {
        select: {
          enrollments: true,
        },
      },
    },
    orderBy: [{ dayIndex: "asc" }, { startsAt: "asc" }, { classCatalog: { title: "asc" } }],
  });

  const slotMap = new Map<
    string,
    {
      slotKey: string;
      label: string;
      offerings: Array<{
        id: string;
        title: string;
        code: string;
        location: string | null;
        dayIndex: number;
        startsAt: string;
        endsAt: string;
        capacity: number;
        enrolledCount: number;
        requirements: RequirementInput[];
      }>;
    }
  >();

  for (const offering of offerings) {
    const slotKey = `${offering.dayIndex}-${offering.startsAt.toISOString()}`;

    if (!slotMap.has(slotKey)) {
      slotMap.set(slotKey, {
        slotKey,
        label: formatSlotLabel(offering.dayIndex, offering.startsAt),
        offerings: [],
      });
    }

    slotMap.get(slotKey)?.offerings.push({
      id: offering.id,
      title: offering.classCatalog.title,
      code: offering.classCatalog.code,
      location: offering.location,
      dayIndex: offering.dayIndex,
      startsAt: offering.startsAt.toISOString(),
      endsAt: offering.endsAt.toISOString(),
      capacity: offering.capacity,
      enrolledCount: offering._count.enrollments,
      requirements: offering.classCatalog.requirements as RequirementInput[],
    });
  }

  const slotGroups = Array.from(slotMap.values());

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Class Assignment</p>
        <h1 className="text-3xl font-semibold text-slate-900">{registration.event.name}</h1>
        <p className="mt-2 text-sm text-slate-600">
          Assign each registered attendee to classes and honors. Capacity updates live as enrollments are made.
        </p>
      </header>

      <ClassAssignmentBoard
        eventId={registration.event.id}
        attendees={registration.attendees.map((attendee) => ({
          id: attendee.rosterMember.id,
          firstName: attendee.rosterMember.firstName,
          lastName: attendee.rosterMember.lastName,
          ageAtStart: attendee.rosterMember.ageAtStart,
          memberRole: attendee.rosterMember.memberRole,
          masterGuide: attendee.rosterMember.masterGuide,
          completedHonorCodes: attendee.rosterMember.completedRequirements.map((item) => item.honorCode),
          enrolledOfferingIds: attendee.rosterMember.classEnrollments.map((enrollment) => enrollment.eventClassOfferingId),
        }))}
        slotGroups={slotGroups}
      />
    </section>
  );
}
