import { RegistrationStatus, type MemberRole, type Prisma, type RequirementType } from "@prisma/client";
import { notFound, redirect } from "next/navigation";

import { auth } from "../../../../../auth";
import { prisma } from "../../../../../lib/prisma";
import { type RequirementInput } from "../../../../../lib/class-prerequisite-utils";
import { ClassAssignmentBoard } from "./_components/class-assignment-board";

type RequirementConfig = {
  minAge?: number;
  maxAge?: number;
  requiredMemberRole?: MemberRole;
  requiredHonorCode?: string;
  requiredMasterGuide?: boolean;
};

function parseRequirementConfig(config: Prisma.JsonValue): RequirementConfig {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return {};
  }

  const raw = config as Record<string, unknown>;

  return {
    minAge: typeof raw.minAge === "number" ? raw.minAge : undefined,
    maxAge: typeof raw.maxAge === "number" ? raw.maxAge : undefined,
    requiredMemberRole: typeof raw.requiredMemberRole === "string" ? (raw.requiredMemberRole as MemberRole) : undefined,
    requiredHonorCode: typeof raw.requiredHonorCode === "string" ? raw.requiredHonorCode : undefined,
    requiredMasterGuide: typeof raw.requiredMasterGuide === "boolean" ? raw.requiredMasterGuide : undefined,
  };
}

function mapRequirementsToEvaluatorInput(
  requirements: Array<{ requirementType: RequirementType; config: Prisma.JsonValue }>,
): RequirementInput[] {
  return requirements.map((requirement) => {
    const config = parseRequirementConfig(requirement.config);

    return {
      requirementType: requirement.requirementType,
      minAge: config.minAge ?? null,
      maxAge: config.maxAge ?? null,
      requiredMemberRole: config.requiredMemberRole ?? null,
      requiredHonorCode: config.requiredHonorCode ?? null,
      requiredMasterGuide: config.requiredMasterGuide ?? null,
    };
  });
}

function readHonorCodeFromMetadata(metadata: Prisma.JsonValue): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = (metadata as Record<string, unknown>).honorCode;
  return typeof value === "string" && value.trim().length > 0 ? value.trim().toUpperCase() : null;
}

function formatSlotLabel(startsAt: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return formatter.format(startsAt);
}

export default async function DirectorClassSelectionPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const session = await auth();

  if (!session?.user || session.user.role !== "CLUB_DIRECTOR") {
    redirect("/login");
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
      status: true,
      event: {
        select: {
          id: true,
          name: true,
          startsAt: true,
          endsAt: true,
          locationName: true,
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
                where: {
                  requirementType: "COMPLETED_HONOR",
                },
                select: {
                  metadata: true,
                },
              },
              classEnrollments: {
                where: {
                  offering: {
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
      capacity: true,
      classCatalog: {
        select: {
          title: true,
          code: true,
          requirements: {
            select: {
              requirementType: true,
              config: true,
            },
          },
        },
      },
      event: {
        select: {
          startsAt: true,
          endsAt: true,
          locationName: true,
        },
      },
      _count: {
        select: {
          enrollments: true,
        },
      },
    },
    orderBy: [{ classCatalog: { title: "asc" } }],
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
        capacity: number | null;
        enrolledCount: number;
        requirements: RequirementInput[];
      }>;
    }
  >();

  for (const offering of offerings) {
    const slotKey = offering.event.startsAt.toISOString();

    if (!slotMap.has(slotKey)) {
      slotMap.set(slotKey, {
        slotKey,
        label: formatSlotLabel(offering.event.startsAt),
        offerings: [],
      });
    }

    slotMap.get(slotKey)?.offerings.push({
      id: offering.id,
      title: offering.classCatalog.title,
      code: offering.classCatalog.code,
      location: offering.event.locationName,
      dayIndex: 0,
      startsAt: offering.event.startsAt.toISOString(),
      endsAt: offering.event.endsAt.toISOString(),
      capacity: offering.capacity,
      enrolledCount: offering._count.enrollments,
      requirements: mapRequirementsToEvaluatorInput(offering.classCatalog.requirements),
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
        {registration.status !== RegistrationStatus.SUBMITTED ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Class assignment is locked until the event registration is submitted.
          </p>
        ) : null}
      </header>

      <ClassAssignmentBoard
        eventId={registration.event.id}
        assignmentLocked={registration.status !== RegistrationStatus.SUBMITTED}
        attendees={registration.attendees.map((attendee) => ({
          id: attendee.rosterMember.id,
          firstName: attendee.rosterMember.firstName,
          lastName: attendee.rosterMember.lastName,
          ageAtStart: attendee.rosterMember.ageAtStart,
          memberRole: attendee.rosterMember.memberRole,
          masterGuide: attendee.rosterMember.masterGuide,
          completedHonorCodes: attendee.rosterMember.completedRequirements
            .map((item) => readHonorCodeFromMetadata(item.metadata))
            .filter((item): item is string => Boolean(item)),
          enrolledOfferingIds: attendee.rosterMember.classEnrollments.map((enrollment) => enrollment.eventClassOfferingId),
        }))}
        slotGroups={slotGroups}
      />
    </section>
  );
}
