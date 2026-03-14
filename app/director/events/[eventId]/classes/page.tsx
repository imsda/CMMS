import { Prisma, type MemberRole, type RequirementType } from "@prisma/client";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { saveRankedClassPreferences } from "../../../../actions/honors-actions";
import { getManagedClubContext } from "../../../../../lib/club-management";
import { CLASS_ASSIGNMENT_POLICY, getSeatsLeft } from "../../../../../lib/class-model";
import {
  evaluateClassRequirements,
  requirementToBadgeLabel,
  type RequirementInput,
} from "../../../../../lib/class-prerequisite-utils";
import { prisma } from "../../../../../lib/prisma";

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

function formatTimeslotRange(startsAt: Date, endsAt: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return `${formatter.format(startsAt)} - ${formatter.format(endsAt)}`;
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
      event: {
        select: {
          id: true,
          eventMode: true,
          name: true,
          classTimeslots: {
            where: {
              active: true,
            },
            orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }],
            select: {
              id: true,
              label: true,
              startsAt: true,
              endsAt: true,
              offerings: {
                where: {
                  active: true,
                },
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
                        select: {
                          requirementType: true,
                          config: true,
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
              },
            },
          },
        },
      },
      attendees: {
        orderBy: [{ rosterMember: { lastName: "asc" } }, { rosterMember: { firstName: "asc" } }],
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
                  offering: {
                    select: {
                      timeslotId: true,
                      classCatalog: {
                        select: {
                          title: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          classPreferences: {
            where: {
              eventId,
            },
            orderBy: {
              rank: "asc",
            },
            select: {
              rank: true,
              timeslotId: true,
              offering: {
                select: {
                  id: true,
                  classCatalog: {
                    select: {
                      title: true,
                    },
                  },
                },
              },
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

  return (
    <section className="space-y-6">
      <header className="glass-panel">
        <p className="hero-kicker">{t("classes.eyebrow")}</p>
        <h1 className="hero-title mt-3">{registration.event.name}</h1>
        <p className="hero-copy">
          Save ranked class choices for each attendee by timeslot. Conference admins can then balance final placement with capacity and prerequisite warnings in view.
        </p>
        <p className="mt-1 text-xs font-medium text-slate-500">{CLASS_ASSIGNMENT_POLICY}</p>
      </header>

      {registration.event.classTimeslots.length === 0 ? (
        <article className="glass-panel text-sm text-slate-600">
          No class timeslots have been published for this event yet.
        </article>
      ) : (
        registration.event.classTimeslots.map((timeslot) => (
          <article key={timeslot.id} className="glass-panel space-y-5">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">{timeslot.label}</h2>
              <p className="mt-1 text-sm text-slate-600">{formatTimeslotRange(timeslot.startsAt, timeslot.endsAt)}</p>
            </div>

            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {timeslot.offerings.map((offering) => {
                const seatsLeft = getSeatsLeft(offering.capacity, offering._count.enrollments);
                const requirements = mapRequirementsToEvaluatorInput(offering.classCatalog.requirements);

                return (
                  <div key={offering.id} className="rounded-2xl border border-white/60 bg-white/70 p-4">
                    <h3 className="text-sm font-semibold text-slate-900">
                      {offering.classCatalog.title}
                      <span className="ml-2 text-xs font-medium text-slate-500">({offering.classCatalog.code})</span>
                    </h3>
                    {offering.classCatalog.description ? (
                      <p className="mt-1 text-xs text-slate-600">{offering.classCatalog.description}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-slate-500">{offering.locationName ?? "Location TBD"}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-700">
                      {seatsLeft === null ? "Open capacity" : `${seatsLeft} seat(s) left`}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {requirements.map((requirement, index) => (
                        <span key={`${offering.id}-${index}`} className="status-chip-warning">
                          {requirementToBadgeLabel(requirement)}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {registration.attendees.map((attendee) => {
                const savedPreferences = attendee.classPreferences
                  .filter((preference) => preference.timeslotId === timeslot.id)
                  .map((preference) => preference.offering.id);
                const currentEnrollment =
                  attendee.rosterMember.classEnrollments.find(
                    (enrollment) => enrollment.offering.timeslotId === timeslot.id || enrollment.offering.timeslotId === null,
                  ) ?? null;

                return (
                  <form key={`${timeslot.id}-${attendee.id}`} action={saveRankedClassPreferences} className="rounded-2xl border border-white/60 bg-white/70 p-4">
                    <input type="hidden" name="eventId" value={registration.event.id} readOnly />
                    <input type="hidden" name="timeslotId" value={timeslot.id} readOnly />
                    <input type="hidden" name="registrationAttendeeId" value={attendee.id} readOnly />
                    {managedClub.isSuperAdmin ? <input type="hidden" name="clubId" value={managedClub.clubId} readOnly /> : null}

                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">
                          {attendee.rosterMember.firstName} {attendee.rosterMember.lastName}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {attendee.rosterMember.memberRole} • Age {attendee.rosterMember.ageAtStart ?? "N/A"}
                        </p>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        <p>Current placement</p>
                        <p className="font-semibold text-slate-700">
                          {currentEnrollment?.offering.classCatalog.title ?? "Unassigned"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      {[0, 1, 2].map((index) => (
                        <label key={`${attendee.id}-${timeslot.id}-${index}`} className="space-y-1 text-sm text-slate-700">
                          <span>Preference #{index + 1}</span>
                          <select
                            name="preferenceOfferingIds"
                            defaultValue={savedPreferences[index] ?? ""}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2"
                          >
                            <option value="">No selection</option>
                            {timeslot.offerings.map((offering) => {
                              const eligibility = evaluateClassRequirements(
                                {
                                  ageAtStart: attendee.rosterMember.ageAtStart,
                                  memberRole: attendee.rosterMember.memberRole,
                                  masterGuide: attendee.rosterMember.masterGuide,
                                  completedHonorCodes: attendee.rosterMember.completedRequirements
                                    .map((item) => readHonorCodeFromMetadata(item.metadata))
                                    .filter((item): item is string => Boolean(item)),
                                },
                                mapRequirementsToEvaluatorInput(offering.classCatalog.requirements),
                              );

                              return (
                                <option key={offering.id} value={offering.id}>
                                  {offering.classCatalog.title}
                                  {!eligibility.eligible ? " (warning)" : ""}
                                </option>
                              );
                            })}
                          </select>
                        </label>
                      ))}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {timeslot.offerings.map((offering) => {
                        const eligibility = evaluateClassRequirements(
                          {
                            ageAtStart: attendee.rosterMember.ageAtStart,
                            memberRole: attendee.rosterMember.memberRole,
                            masterGuide: attendee.rosterMember.masterGuide,
                            completedHonorCodes: attendee.rosterMember.completedRequirements
                              .map((item) => readHonorCodeFromMetadata(item.metadata))
                              .filter((item): item is string => Boolean(item)),
                          },
                          mapRequirementsToEvaluatorInput(offering.classCatalog.requirements),
                        );

                        if (eligibility.eligible) {
                          return null;
                        }

                        return (
                          <span key={`${attendee.id}-${offering.id}`} className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                            {offering.classCatalog.code}: {eligibility.blockers.join(", ")}
                          </span>
                        );
                      })}
                    </div>

                    <div className="mt-4">
                      <button type="submit" className="btn-primary">
                        Save Preferences
                      </button>
                    </div>
                  </form>
                );
              })}
            </div>
          </article>
        ))
      )}
    </section>
  );
}
