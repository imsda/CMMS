import { Prisma, type MemberRole, type RequirementType } from "@prisma/client";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getManagedClubContext } from "../../../../../lib/club-management";
import { prisma } from "../../../../../lib/prisma";
import { ClassAssignmentBoardClient } from "./class-assignment-board-client";

function readHonorCodeFromMetadata(metadata: Prisma.JsonValue): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = (metadata as Record<string, unknown>).honorCode;
  return typeof value === "string" && value.trim().length > 0 ? value.trim().toUpperCase() : null;
}

function parseRequirementConfig(config: Prisma.JsonValue): {
  minAge: number | null;
  maxAge: number | null;
  requiredMemberRole: MemberRole | null;
  requiredHonorCode: string | null;
  requiredMasterGuide: boolean | null;
} {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return { minAge: null, maxAge: null, requiredMemberRole: null, requiredHonorCode: null, requiredMasterGuide: null };
  }
  const raw = config as Record<string, unknown>;
  return {
    minAge: typeof raw.minAge === "number" ? raw.minAge : null,
    maxAge: typeof raw.maxAge === "number" ? raw.maxAge : null,
    requiredMemberRole:
      typeof raw.requiredMemberRole === "string" ? (raw.requiredMemberRole as MemberRole) : null,
    requiredHonorCode: typeof raw.requiredHonorCode === "string" ? raw.requiredHonorCode : null,
    requiredMasterGuide:
      typeof raw.requiredMasterGuide === "boolean" ? raw.requiredMasterGuide : null,
  };
}

export default async function DirectorClassSelectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams?: Promise<{ clubId?: string }>;
}) {
  const t = await getTranslations("Director");
  const { eventId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const managedClub = await getManagedClubContext(resolvedSearchParams?.clubId ?? null);

  if (!managedClub.clubId) {
    return (
      <section className="glass-panel">
        <h1 className="text-xl font-semibold">{t("common.clubNotFound")}</h1>
        <p className="mt-2 text-sm">{t("classes.clubNotFoundDescription")}</p>
      </section>
    );
  }

  const registration = await prisma.eventRegistration.findFirst({
    where: {
      eventId,
      clubId: managedClub.clubId,
    },
    select: {
      id: true,
      event: {
        select: {
          id: true,
          eventMode: true,
          name: true,
          classTimeslots: {
            where: { active: true },
            orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }],
            select: {
              id: true,
              label: true,
              startsAt: true,
              endsAt: true,
              offerings: {
                where: { active: true },
                orderBy: [{ classCatalog: { title: "asc" } }],
                select: {
                  id: true,
                  capacity: true,
                  locationName: true,
                  classCatalog: {
                    select: {
                      title: true,
                      code: true,
                      description: true,
                      requirements: {
                        select: { requirementType: true, config: true },
                      },
                    },
                  },
                  _count: { select: { enrollments: true } },
                },
              },
            },
          },
        },
      },
      attendees: {
        orderBy: [
          { rosterMember: { lastName: "asc" } },
          { rosterMember: { firstName: "asc" } },
        ],
        select: {
          id: true,
          rosterMemberId: true,
          rosterMember: {
            select: {
              firstName: true,
              lastName: true,
              ageAtStart: true,
              memberRole: true,
              masterGuide: true,
              completedRequirements: {
                where: { requirementType: "COMPLETED_HONOR" },
                select: { metadata: true },
              },
              classEnrollments: {
                where: { offering: { eventId } },
                select: {
                  offering: {
                    select: {
                      timeslotId: true,
                      classCatalog: { select: { title: true } },
                    },
                  },
                },
              },
            },
          },
          classPreferences: {
            where: { eventId },
            orderBy: { rank: "asc" },
            select: {
              timeslotId: true,
              offering: { select: { id: true } },
            },
          },
        },
      },
    },
  });

  if (!registration) {
    notFound();
  }

  if (registration.event.eventMode !== "CLASS_ASSIGNMENT") {
    return (
      <section className="glass-panel">
        <h1 className="text-xl font-semibold text-slate-900">{t("classes.eyebrow")}</h1>
        <p className="mt-2 text-sm text-slate-600">{t("classes.notEnabled")}</p>
      </section>
    );
  }

  // Shape timeslots for the client component
  const classTimeslots = registration.event.classTimeslots.map((ts) => ({
    id: ts.id,
    label: ts.label,
    startsAt: ts.startsAt.toISOString(),
    endsAt: ts.endsAt.toISOString(),
    offerings: ts.offerings.map((o) => ({
      id: o.id,
      capacity: o.capacity,
      locationName: o.locationName,
      enrolledCount: o._count.enrollments,
      classCatalog: {
        title: o.classCatalog.title,
        code: o.classCatalog.code,
        description: o.classCatalog.description,
        requirements: o.classCatalog.requirements.map((r) => ({
          requirementType: r.requirementType as RequirementType,
          ...parseRequirementConfig(r.config),
        })),
      },
    })),
  }));

  // Shape attendees for the client component
  const attendees = registration.attendees.map((attendee) => {
    // Build savedPreferences: timeslotId -> offeringIds[]
    const savedPreferences: Record<string, string[]> = {};
    for (const pref of attendee.classPreferences) {
      if (!savedPreferences[pref.timeslotId]) {
        savedPreferences[pref.timeslotId] = [];
      }
      savedPreferences[pref.timeslotId].push(pref.offering.id);
    }

    return {
      id: attendee.id,
      rosterMemberId: attendee.rosterMemberId,
      rosterMember: {
        firstName: attendee.rosterMember.firstName,
        lastName: attendee.rosterMember.lastName,
        ageAtStart: attendee.rosterMember.ageAtStart,
        memberRole: attendee.rosterMember.memberRole,
        masterGuide: attendee.rosterMember.masterGuide,
        completedHonorCodes: attendee.rosterMember.completedRequirements
          .map((r) => readHonorCodeFromMetadata(r.metadata))
          .filter((c): c is string => Boolean(c)),
        currentEnrollments: attendee.rosterMember.classEnrollments.map((e) => ({
          timeslotId: e.offering.timeslotId,
          classTitle: e.offering.classCatalog.title,
        })),
      },
      savedPreferences,
    };
  });

  return (
    <ClassAssignmentBoardClient
      eventId={registration.event.id}
      eventName={registration.event.name}
      registrationId={registration.id}
      clubId={managedClub.clubId}
      isSuperAdmin={managedClub.isSuperAdmin}
      classTimeslots={classTimeslots}
      attendees={attendees}
    />
  );
}
