import Link from "next/link";
import { notFound } from "next/navigation";
import { Prisma, UserRole, type MemberRole, type RequirementType } from "@prisma/client";

import {
  clearEventClassOfferingEnrollmentsAction,
  createEventClassOfferingAction,
  createEventClassTimeslotAction,
  migrateLegacyEventClassOfferingsAction,
  removeEventClassOfferingAction,
  removeEventClassTimeslotAction,
  updateEventClassOfferingAction,
  updateEventClassTimeslotAction,
} from "../../../../actions/admin-actions";
import {
  addAttendeeToClassWaitlist,
  assignAttendeeToTimeslotOffering,
  assignSuggestedTimeslotOffering,
  bulkAssignSuggestedTimeslotOfferings,
  bulkClearTimeslotPlacements,
  bulkReassignTimeslotOfferings,
  promoteClassWaitlistEntries,
  removeAttendeeFromClassWaitlist,
} from "../../../../actions/honors-actions";
import { CLASS_ASSIGNMENT_POLICY, getSeatsLeft } from "../../../../../lib/class-model";
import {
  evaluateClassRequirements,
  requirementToBadgeLabel,
  type RequirementInput,
} from "../../../../../lib/class-prerequisite-utils";
import { getCapacityPressureLevel, suggestPlacement } from "../../../../../lib/honors-placement";
import { getEventModeConfig } from "../../../../../lib/event-modes";
import { prisma } from "../../../../../lib/prisma";
import { buildCsvHref, slugifyFilenamePart } from "../../../../../lib/csv";
import { AdminPageHeader } from "../../../_components/admin-page-header";

type AdminEventClassesPageProps = {
  params: Promise<{ eventId: string }>;
  searchParams?: Promise<{
    actionStatus?: string;
    actionMessage?: string;
    placementFilter?: string;
    blockerFilter?: string;
    clubFilter?: string;
    roleFilter?: string;
  }>;
};

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

function formatDateTime(value: Date) {
  return value.toISOString().slice(0, 16);
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

function getPressureClasses(level: ReturnType<typeof getCapacityPressureLevel>["level"]) {
  switch (level) {
    case "full":
      return "bg-rose-100 text-rose-800";
    case "tight":
    case "waitlist":
      return "bg-amber-100 text-amber-800";
    case "watch":
      return "bg-sky-100 text-sky-800";
    case "open":
    default:
      return "bg-emerald-100 text-emerald-800";
  }
}

function isAgeBlockerMessage(message: string) {
  return message.startsWith("Requires Age") || message.startsWith("Max Age");
}

function getSlotHealthTone(unplaced: number, waitlisted: number) {
  if (unplaced > 0) {
    return "status-chip-danger";
  }
  if (waitlisted > 0) {
    return "status-chip-warning";
  }
  return "status-chip-success";
}

export default async function AdminEventClassesPage({
  params,
  searchParams,
}: AdminEventClassesPageProps) {
  const { eventId } = await params;
  const resolvedSearchParams = await searchParams;
  const actionStatus = resolvedSearchParams?.actionStatus;
  const actionMessage = resolvedSearchParams?.actionMessage;

  const [event, catalogItems, teachers, registrations] = await Promise.all([
    prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        name: true,
        eventMode: true,
        startsAt: true,
        endsAt: true,
        classTimeslots: {
          orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }],
          select: {
            id: true,
            label: true,
            startsAt: true,
            endsAt: true,
            sortOrder: true,
            active: true,
            offerings: {
              include: {
                enrollments: {
                  select: {
                    rosterMemberId: true,
                    attendedAt: true,
                  },
                },
                preferences: {
                  select: {
                    rank: true,
                  },
                },
                waitlistEntries: {
                  orderBy: {
                    position: "asc",
                  },
                  select: {
                    id: true,
                    position: true,
                    registrationAttendeeId: true,
                    registrationAttendee: {
                      select: {
                        rosterMember: {
                          select: {
                            firstName: true,
                            lastName: true,
                          },
                        },
                        eventRegistration: {
                          select: {
                            club: {
                              select: {
                                code: true,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                classCatalog: {
                  select: {
                    id: true,
                    title: true,
                    code: true,
                    description: true,
                    classType: true,
                    requirements: {
                      select: {
                        requirementType: true,
                        config: true,
                      },
                    },
                  },
                },
                teacher: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
                _count: {
                  select: {
                    enrollments: true,
                  },
                },
              },
              orderBy: [{ active: "desc" }, { classCatalog: { title: "asc" } }],
            },
          },
        },
        classOfferings: {
          where: {
            timeslotId: null,
          },
          include: {
            enrollments: {
              select: {
                attendedAt: true,
              },
            },
            waitlistEntries: {
              orderBy: {
                position: "asc",
              },
              select: {
                id: true,
                position: true,
              },
            },
            classCatalog: {
              select: {
                id: true,
                title: true,
                code: true,
                description: true,
                classType: true,
                requirements: {
                  select: {
                    requirementType: true,
                    config: true,
                  },
                },
              },
            },
            teacher: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            _count: {
              select: {
                enrollments: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    }),
    prisma.classCatalog.findMany({
      where: { active: true },
      select: {
        id: true,
        title: true,
        code: true,
        classType: true,
      },
      orderBy: {
        title: "asc",
      },
    }),
    prisma.user.findMany({
      where: {
        role: UserRole.STAFF_TEACHER,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
    prisma.eventRegistration.findMany({
      where: {
        eventId,
        attendees: {
          some: {},
        },
      },
      select: {
        id: true,
        clubId: true,
        club: {
          select: {
            name: true,
            code: true,
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
                    eventClassOfferingId: true,
                    attendedAt: true,
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
              orderBy: {
                rank: "asc",
              },
            },
            classWaitlistEntries: {
              where: {
                eventId,
              },
              select: {
                id: true,
                timeslotId: true,
                eventClassOfferingId: true,
                position: true,
                offering: {
                  select: {
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
      orderBy: [{ club: { name: "asc" } }],
    }),
  ]);

  if (!event) {
    notFound();
  }

  const eventModeConfig = getEventModeConfig(event.eventMode);
  const placementFilter =
    resolvedSearchParams?.placementFilter === "placed" ||
    resolvedSearchParams?.placementFilter === "unplaced" ||
    resolvedSearchParams?.placementFilter === "waitlisted"
      ? resolvedSearchParams.placementFilter
      : "all";
  const blockerFilter =
    resolvedSearchParams?.blockerFilter === "prerequisite" ||
    resolvedSearchParams?.blockerFilter === "age"
      ? resolvedSearchParams.blockerFilter
      : "all";
  const clubFilter = resolvedSearchParams?.clubFilter?.trim() ?? "";
  const roleFilter = resolvedSearchParams?.roleFilter?.trim() ?? "";
  const availableClubFilters = registrations.map((registration) => ({
    id: registration.clubId,
    label: `${registration.club.name} (${registration.club.code})`,
  }));
  const availableRoleFilters = Array.from(
    new Set(
      registrations.flatMap((registration) =>
        registration.attendees.map((attendee) => attendee.rosterMember.memberRole),
      ),
    ),
  ).sort();
  const assignedCatalogKeys = new Set(
    [
      ...event.classTimeslots.flatMap((timeslot) =>
        timeslot.offerings.map((offering) => `${offering.classCatalog.id}:${timeslot.id}`),
      ),
      ...event.classOfferings.map((offering) => `${offering.classCatalog.id}:legacy`),
    ],
  );
  const honorsFileBase = `${slugifyFilenamePart(event.name)}-honors`;
  const placementSummaryRows = event.classTimeslots.map((timeslot) => {
    const allRows = registrations.flatMap((registration) =>
      registration.attendees.map((attendee) => {
        const currentEnrollment =
          attendee.rosterMember.classEnrollments.find(
            (enrollment) =>
              enrollment.offering.timeslotId === timeslot.id || enrollment.offering.timeslotId === null,
          ) ?? null;
        const currentWaitlist = attendee.classWaitlistEntries.find((entry) => entry.timeslotId === timeslot.id) ?? null;
        return { currentEnrollment, currentWaitlist };
      }),
    );
    const totalSeats = timeslot.offerings.reduce((sum, offering) => sum + (offering.capacity ?? 0), 0);
    const openSeats = timeslot.offerings.reduce((sum, offering) => sum + (getSeatsLeft(offering.capacity, offering._count.enrollments) ?? 0), 0);
    const waitlisted = timeslot.offerings.reduce((sum, offering) => sum + offering.waitlistEntries.length, 0);
    const placed = allRows.filter((row) => Boolean(row.currentEnrollment)).length;
    const unplaced = allRows.filter((row) => !row.currentEnrollment && !row.currentWaitlist).length;

    return {
      label: timeslot.label,
      attendeeCount: allRows.length,
      totalSeats,
      openSeats,
      waitlisted,
      placed,
      unplaced,
    };
  });
  const rosterRows = event.classTimeslots.flatMap((timeslot) =>
    timeslot.offerings.flatMap((offering) =>
      registrations.flatMap((registration) =>
        registration.attendees.flatMap((attendee) => {
          const enrollment = attendee.rosterMember.classEnrollments.find(
            (item) => item.eventClassOfferingId === offering.id,
          );
          if (!enrollment) {
            return [];
          }

          return [[
            timeslot.label,
            offering.classCatalog.title,
            offering.classCatalog.code,
            offering.teacher?.name ?? "",
            offering.locationName ?? "",
            `${attendee.rosterMember.firstName} ${attendee.rosterMember.lastName}`,
            registration.club.code,
            attendee.rosterMember.memberRole,
            enrollment.attendedAt ? "Attended" : "Enrolled",
          ]];
        }),
      ),
    ),
  );
  const waitlistRows = event.classTimeslots.flatMap((timeslot) =>
    timeslot.offerings.flatMap((offering) =>
      offering.waitlistEntries.map((entry) => [
        timeslot.label,
        offering.classCatalog.title,
        offering.classCatalog.code,
        entry.position,
        `${entry.registrationAttendee.rosterMember.firstName} ${entry.registrationAttendee.rosterMember.lastName}`,
        entry.registrationAttendee.eventRegistration.club.code,
      ]),
    ),
  );
  const placementSummaryCsvHref = buildCsvHref([
    ["Timeslot", "Attendees", "Total Seats", "Open Seats", "Placed", "Waitlisted", "Unplaced"],
    ...placementSummaryRows.map((row) => [row.label, row.attendeeCount, row.totalSeats, row.openSeats, row.placed, row.waitlisted, row.unplaced]),
  ]);
  const rosterCsvHref = buildCsvHref([
    ["Timeslot", "Class", "Code", "Teacher", "Location", "Attendee", "Club", "Role", "Status"],
    ...rosterRows,
  ]);
  const waitlistCsvHref = buildCsvHref([
    ["Timeslot", "Class", "Code", "Position", "Attendee", "Club"],
    ...waitlistRows,
  ]);

  return (
    <section className="space-y-6">
      <AdminPageHeader
        eyebrow="Event Management"
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Events", href: "/admin/events" },
          { label: event.name, href: `/admin/events/${event.id}` },
          { label: "Classes" },
        ]}
        title="Honors and Class Assignment"
        description={`Manage timeslots, class offerings, and attendee placement for ${event.name}.`}
        secondaryActions={
          <>
            <Link href={`/admin/events/${event.id}`} className="btn-secondary">
              Back to Overseer
            </Link>
            <Link href="/admin/catalog" className="btn-secondary">
              Open Catalog
            </Link>
          </>
        }
        details={
          <>
            <div>
              <dt className="font-semibold text-slate-900">Mode</dt>
              <dd>{eventModeConfig.label}</dd>
            </div>
            <div className="md:col-span-2 xl:col-span-3">
              <dt className="font-semibold text-slate-900">Assignment policy</dt>
              <dd>{CLASS_ASSIGNMENT_POLICY}</dd>
            </div>
          </>
        }
      />

      {event.eventMode !== "CLASS_ASSIGNMENT" ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This event is currently configured as {eventModeConfig.label}. The honors assignment workflow is optimized for CLASS_ASSIGNMENT events.
        </p>
      ) : null}

      {actionStatus && actionMessage ? (
        <p
          className={`rounded-lg px-4 py-3 text-sm ${
            actionStatus === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {actionMessage}
        </p>
      ) : null}

      <div className="workflow-summary-grid">
        <article className="metric-card">
          <p className="metric-label">Timeslots</p>
          <p className="metric-value">{event.classTimeslots.length}</p>
          <p className="metric-caption">Structured assignment windows configured.</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Offerings</p>
          <p className="metric-value">
            {event.classTimeslots.reduce((sum, timeslot) => sum + timeslot.offerings.length, 0) + event.classOfferings.length}
          </p>
          <p className="metric-caption">Catalog-linked honors and classes in play.</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Roster attendees</p>
          <p className="metric-value">{registrations.reduce((sum, registration) => sum + registration.attendees.length, 0)}</p>
          <p className="metric-caption">Attendees available for placement across clubs.</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Legacy offerings</p>
          <p className="metric-value">{event.classOfferings.length}</p>
          <p className="metric-caption">Offerings still outside slot-pure scheduling.</p>
        </article>
      </div>

      <article className="workflow-studio">
        <div className="workflow-header">
          <div>
            <p className="hero-kicker">Operations Packet</p>
            <h2 className="section-title">Operational summaries and exports</h2>
            <p className="section-copy">Download class rosters, waitlists, and slot-level placement summaries for event operations, teacher packets, and print-ready review.</p>
          </div>
          <div className="workflow-actions">
            <a href={placementSummaryCsvHref} download={`${honorsFileBase}-placement-summary.csv`} className="btn-secondary">Placement Summary CSV</a>
            <a href={rosterCsvHref} download={`${honorsFileBase}-class-rosters.csv`} className="btn-secondary">Class Rosters CSV</a>
            <a href={waitlistCsvHref} download={`${honorsFileBase}-waitlists.csv`} className="btn-secondary">Waitlists CSV</a>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {placementSummaryRows.map((row) => (
            <article key={`${row.label}-ops-summary`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-base font-semibold text-slate-900">{row.label}</h3>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-slate-500">Attendees</dt><dd className="font-semibold text-slate-900">{row.attendeeCount}</dd></div>
                <div><dt className="text-slate-500">Seats</dt><dd className="font-semibold text-slate-900">{row.totalSeats}</dd></div>
                <div><dt className="text-slate-500">Placed</dt><dd className="font-semibold text-emerald-700">{row.placed}</dd></div>
                <div><dt className="text-slate-500">Open</dt><dd className="font-semibold text-sky-700">{row.openSeats}</dd></div>
                <div><dt className="text-slate-500">Waitlisted</dt><dd className="font-semibold text-amber-700">{row.waitlisted}</dd></div>
                <div><dt className="text-slate-500">Unplaced</dt><dd className="font-semibold text-rose-700">{row.unplaced}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      </article>

      <section className="workflow-studio">
        <div className="workflow-header">
          <div>
            <p className="hero-kicker">Setup Studio</p>
            <h2 className="section-title">Shape the schedule and assignment catalog</h2>
            <p className="section-copy">Configure timeslots first, then attach catalog honors with teacher, capacity, and location details.</p>
          </div>
        </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr,1fr]">
        <article className="workflow-card-muted">
          <h2 className="text-lg font-semibold text-slate-900">Add Timeslot</h2>
          <p className="mt-1 text-sm text-slate-600">
            Create structured assignment windows like Sabbath Afternoon or Sunday Morning.
          </p>

          <form action={createEventClassTimeslotAction} className="mt-4 grid gap-4 md:grid-cols-2">
            <input type="hidden" name="eventId" value={event.id} readOnly />
            <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
              <span>Timeslot label</span>
              <input name="label" required className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Sabbath Afternoon" />
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span>Starts at</span>
              <input name="startsAt" type="datetime-local" required className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span>Ends at</span>
              <input name="endsAt" type="datetime-local" required className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span>Sort order</span>
              <input name="sortOrder" type="number" min={0} defaultValue={event.classTimeslots.length} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="active" defaultChecked />
              Active in director selection
            </label>
            <div className="md:col-span-2">
              <button type="submit" className="btn-primary">Create Timeslot</button>
            </div>
          </form>
        </article>

        <article className="workflow-card-muted">
          <h2 className="text-lg font-semibold text-slate-900">Add Class Offering</h2>
          <p className="mt-1 text-sm text-slate-600">
            Attach catalog honors or classes to a specific event timeslot, assign a teacher, and set location and capacity.
          </p>

          <form action={createEventClassOfferingAction} className="mt-4 grid gap-4 md:grid-cols-2">
            <input type="hidden" name="eventId" value={event.id} readOnly />

            <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
              <span>Catalog class</span>
              <select name="classCatalogId" required defaultValue="" className="w-full rounded-lg border border-slate-300 px-3 py-2">
                <option value="" disabled>Select class</option>
                {catalogItems.map((item) => (
                  <option
                    key={item.id}
                    value={item.id}
                    disabled={event.classTimeslots.some((timeslot) => assignedCatalogKeys.has(`${item.id}:${timeslot.id}`))}
                  >
                    {item.title} ({item.code}) • {item.classType}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm text-slate-700">
              <span>Timeslot</span>
              <select name="timeslotId" defaultValue="" className="w-full rounded-lg border border-slate-300 px-3 py-2">
                <option value="">Legacy / no timeslot</option>
                {event.classTimeslots.map((timeslot) => (
                  <option key={timeslot.id} value={timeslot.id}>
                    {timeslot.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm text-slate-700">
              <span>Teacher</span>
              <select name="teacherUserId" defaultValue="" className="w-full rounded-lg border border-slate-300 px-3 py-2">
                <option value="">Unassigned</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name} ({teacher.email})
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm text-slate-700">
              <span>Capacity</span>
              <input name="capacity" type="number" min={0} step={1} placeholder="Open" className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>

            <label className="space-y-1 text-sm text-slate-700">
              <span>Location override</span>
              <input name="locationName" placeholder="Lodge A / Pavilion 2" className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
              <input type="checkbox" name="active" defaultChecked />
              Active and visible for preferences and placement
            </label>

            <div className="md:col-span-2">
              <button type="submit" className="btn-primary">Add Offering</button>
            </div>
          </form>
        </article>
      </div>

      <article className="workflow-card-muted">
        <div className="workflow-header">
          <div>
            <h2 className="section-title">Timeslots and offerings</h2>
            <p className="section-copy">Each attendee can be assigned to one class per timeslot. Use these sections to keep the event schedule structured before live placement begins.</p>
          </div>
        </div>

        {event.classTimeslots.length === 0 ? (
          <p className="text-sm text-slate-600">No timeslots have been configured yet.</p>
        ) : (
          <div className="space-y-4">
            {event.classTimeslots.map((timeslot) => (
              <article key={timeslot.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{timeslot.label}</h3>
                    <p className="mt-1 text-sm text-slate-600">{formatTimeslotRange(timeslot.startsAt, timeslot.endsAt)}</p>
                    <p className="mt-1 text-xs text-slate-500">{timeslot.active ? "Active for preference capture" : "Inactive / hidden from new preference capture"}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <form action={updateEventClassTimeslotAction} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="eventId" value={event.id} readOnly />
                      <input type="hidden" name="timeslotId" value={timeslot.id} readOnly />
                      <input type="hidden" name="label" value={timeslot.label} readOnly />
                      <input type="hidden" name="startsAt" value={formatDateTime(timeslot.startsAt)} readOnly />
                      <input type="hidden" name="endsAt" value={formatDateTime(timeslot.endsAt)} readOnly />
                      <input type="hidden" name="sortOrder" value={timeslot.sortOrder} readOnly />
                      <input type="hidden" name="active" value={timeslot.active ? "off" : "on"} readOnly />
                      <button type="submit" className="btn-secondary">
                        {timeslot.active ? "Hide" : "Activate"}
                      </button>
                    </form>
                    <form action={removeEventClassTimeslotAction}>
                      <input type="hidden" name="eventId" value={event.id} readOnly />
                      <input type="hidden" name="timeslotId" value={timeslot.id} readOnly />
                      <button type="submit" className="btn-secondary">Remove</button>
                    </form>
                  </div>
                </div>

                {timeslot.offerings.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-600">No offerings have been attached to this timeslot yet.</p>
                ) : (
                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    {timeslot.offerings.map((offering) => {
                      const requirements = mapRequirementsToEvaluatorInput(offering.classCatalog.requirements);
                      const seatsLeft = getSeatsLeft(offering.capacity, offering._count.enrollments);
                      const attendedCount = offering.enrollments.filter((enrollment) => enrollment.attendedAt !== null).length;
                      const pressure = getCapacityPressureLevel({
                        capacity: offering.capacity,
                        enrolledCount: offering._count.enrollments,
                        waitlistCount: offering.waitlistEntries.length,
                      });

                      return (
                        <article key={offering.id} className="workflow-card-muted">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h4 className="text-base font-semibold text-slate-900">
                                {offering.classCatalog.title}
                                <span className="ml-2 text-xs font-medium text-slate-500">({offering.classCatalog.code})</span>
                              </h4>
                              <p className="mt-1 text-xs text-slate-500">{offering.classCatalog.classType}</p>
                              {offering.classCatalog.description ? (
                                <p className="mt-2 text-sm text-slate-600">{offering.classCatalog.description}</p>
                              ) : null}
                            </div>
                            <div className="text-right text-xs font-semibold text-slate-600">
                              <p>{seatsLeft === null ? "Open seats" : `${seatsLeft} seat(s) left`}</p>
                              <p className="mt-1">{offering.preferences.length} preference vote(s)</p>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getPressureClasses(pressure.level)}`}>
                              {pressure.label}
                            </span>
                            {requirements.map((requirement, index) => (
                              <span key={`${offering.id}-req-${index}`} className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                                {requirementToBadgeLabel(requirement)}
                              </span>
                            ))}
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${offering.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>
                              {offering.active ? "Active" : "Inactive"}
                            </span>
                          </div>

                          <form action={updateEventClassOfferingAction} className="mt-4 grid gap-3 md:grid-cols-2">
                            <input type="hidden" name="eventId" value={event.id} readOnly />
                            <input type="hidden" name="offeringId" value={offering.id} readOnly />

                            <label className="space-y-1 text-sm text-slate-700">
                              <span>Teacher</span>
                              <select name="teacherUserId" defaultValue={offering.teacher?.id ?? ""} className="w-full rounded-lg border border-slate-300 px-3 py-2">
                                <option value="">Unassigned</option>
                                {teachers.map((teacher) => (
                                  <option key={teacher.id} value={teacher.id}>
                                    {teacher.name} ({teacher.email})
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="space-y-1 text-sm text-slate-700">
                              <span>Timeslot</span>
                              <select name="timeslotId" defaultValue={offering.timeslotId ?? ""} className="w-full rounded-lg border border-slate-300 px-3 py-2">
                                <option value="">Legacy / no timeslot</option>
                                {event.classTimeslots.map((slotOption) => (
                                  <option key={slotOption.id} value={slotOption.id}>
                                    {slotOption.label}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="space-y-1 text-sm text-slate-700">
                              <span>Capacity</span>
                              <input name="capacity" type="number" min={offering._count.enrollments} step={1} defaultValue={offering.capacity ?? ""} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                            </label>

                            <label className="space-y-1 text-sm text-slate-700">
                              <span>Location</span>
                              <input name="locationName" defaultValue={offering.locationName ?? ""} placeholder={event.name} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                            </label>

                            <label className="flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
                              <input type="checkbox" name="active" defaultChecked={offering.active} />
                              Visible for preference capture and placement
                            </label>

                            <div className="md:col-span-2">
                              <button type="submit" className="btn-secondary">Save Offering</button>
                            </div>
                          </form>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <form action={removeEventClassOfferingAction}>
                              <input type="hidden" name="eventId" value={event.id} readOnly />
                              <input type="hidden" name="offeringId" value={offering.id} readOnly />
                              <button type="submit" disabled={offering._count.enrollments > 0} className="btn-secondary">
                                Remove
                              </button>
                            </form>
                            {offering._count.enrollments > 0 ? (
                              <form action={clearEventClassOfferingEnrollmentsAction}>
                                <input type="hidden" name="eventId" value={event.id} readOnly />
                                <input type="hidden" name="offeringId" value={offering.id} readOnly />
                                <button type="submit" className="btn-secondary">Clear Enrollments</button>
                              </form>
                            ) : null}
                          </div>

                          <p className="mt-3 text-xs text-slate-500">
                            Enrolled {offering._count.enrollments} • Waitlist {offering.waitlistEntries.length} • Attendance marked {attendedCount}
                          </p>

                          {offering.waitlistEntries.length > 0 ? (
                            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <h5 className="text-sm font-semibold text-slate-900">Waitlist queue</h5>
                                  <p className="text-xs text-slate-600">Promote the next attendee or fill newly opened seats.</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <form action={promoteClassWaitlistEntries}>
                                    <input type="hidden" name="eventId" value={event.id} readOnly />
                                    <input type="hidden" name="eventClassOfferingId" value={offering.id} readOnly />
                                    <input type="hidden" name="promotionCount" value="1" readOnly />
                                    <button type="submit" className="btn-secondary">Promote Next</button>
                                  </form>
                                  <form action={promoteClassWaitlistEntries}>
                                    <input type="hidden" name="eventId" value={event.id} readOnly />
                                    <input type="hidden" name="eventClassOfferingId" value={offering.id} readOnly />
                                    <input type="hidden" name="fillOpenSeats" value="on" readOnly />
                                    <button type="submit" className="btn-secondary">Auto-fill Open Seats</button>
                                  </form>
                                </div>
                              </div>

                              <form action={promoteClassWaitlistEntries} className="mt-3 flex flex-wrap items-end gap-3">
                                <input type="hidden" name="eventId" value={event.id} readOnly />
                                <input type="hidden" name="eventClassOfferingId" value={offering.id} readOnly />
                                <label className="space-y-1 text-xs text-slate-700">
                                  <span>Promote multiple</span>
                                  <input
                                    name="promotionCount"
                                    type="number"
                                    min={1}
                                    max={offering.waitlistEntries.length}
                                    defaultValue={Math.min(3, offering.waitlistEntries.length)}
                                    className="w-28 rounded-lg border border-slate-300 px-3 py-2"
                                  />
                                </label>
                                <button type="submit" className="btn-secondary">Promote Batch</button>
                              </form>

                              <ol className="mt-3 space-y-2">
                                {offering.waitlistEntries.map((entry) => (
                                  <li key={entry.id} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-xs text-slate-700">
                                    <span>
                                      #{entry.position} {entry.registrationAttendee.rosterMember.firstName}{" "}
                                      {entry.registrationAttendee.rosterMember.lastName} (
                                      {entry.registrationAttendee.eventRegistration.club.code})
                                    </span>
                                  </li>
                                ))}
                              </ol>
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}

        {event.classOfferings.length > 0 ? (
          <article className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
            <h3 className="text-base font-semibold text-slate-900">Legacy Offerings Without a Timeslot</h3>
            <p className="mt-1 text-sm text-slate-600">
              These existing offerings still work, but migrating them into a named cleanup slot is the safest path toward a slot-pure event.
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-700">
              {event.classOfferings.map((offering) => (
                <span key={offering.id} className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">
                  {offering.classCatalog.title} ({offering.classCatalog.code})
                </span>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
              <h4 className="text-sm font-semibold text-slate-900">Legacy cleanup migration</h4>
              <p className="mt-1 text-sm text-slate-600">
                Create one inactive cleanup timeslot, move all legacy offerings into it, then split or rename them as needed. This preserves enrollments while removing null-slot conflicts from future placement.
              </p>
              <form action={migrateLegacyEventClassOfferingsAction} className="mt-4 grid gap-3 md:grid-cols-3">
                <input type="hidden" name="eventId" value={event.id} readOnly />
                <input type="hidden" name="startsAt" value={formatDateTime(event.startsAt)} readOnly />
                <input type="hidden" name="endsAt" value={formatDateTime(event.endsAt)} readOnly />
                <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
                  <span>Cleanup timeslot label</span>
                  <input
                    name="label"
                    required
                    defaultValue="Legacy Cleanup Slot"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                <div className="flex items-end">
                  <button type="submit" className="btn-secondary w-full">Migrate Legacy Offerings</button>
                </div>
              </form>
            </div>
          </article>
        ) : null}
      </article>
      </section>

      {event.eventMode === "CLASS_ASSIGNMENT" ? (
        <article className="workflow-studio">
          <div className="workflow-header">
            <div>
              <p className="hero-kicker">Placement Studio</p>
              <h2 className="section-title">Placement board</h2>
              <p className="section-copy">
              Review each attendee by timeslot, compare saved preferences and blockers, and place them into the best-fit class.
              </p>
            </div>
            <div className="workflow-actions">
              <span className="status-chip-neutral">{placementFilter === "all" ? "All placements" : placementFilter}</span>
              <span className="status-chip-neutral">{blockerFilter === "all" ? "All blocker states" : blockerFilter}</span>
            </div>
          </div>

          <form className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-4">
            <label className="space-y-1 text-sm text-slate-700">
              <span>Placement</span>
              <select name="placementFilter" defaultValue={placementFilter} className="w-full rounded-lg border border-slate-300 px-3 py-2">
                <option value="all">All attendees</option>
                <option value="unplaced">Unplaced only</option>
                <option value="waitlisted">Waitlisted only</option>
                <option value="placed">Placed only</option>
              </select>
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span>Blockers</span>
              <select name="blockerFilter" defaultValue={blockerFilter} className="w-full rounded-lg border border-slate-300 px-3 py-2">
                <option value="all">All blocker states</option>
                <option value="prerequisite">Blocked by prerequisites</option>
                <option value="age">Blocked by age</option>
              </select>
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span>Club</span>
              <select name="clubFilter" defaultValue={clubFilter} className="w-full rounded-lg border border-slate-300 px-3 py-2">
                <option value="">All clubs</option>
                {availableClubFilters.map((clubOption) => (
                  <option key={clubOption.id} value={clubOption.id}>
                    {clubOption.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span>Role</span>
              <select name="roleFilter" defaultValue={roleFilter} className="w-full rounded-lg border border-slate-300 px-3 py-2">
                <option value="">All roles</option>
                {availableRoleFilters.map((roleOption) => (
                  <option key={roleOption} value={roleOption}>
                    {roleOption}
                  </option>
                ))}
              </select>
            </label>
            <div className="md:col-span-4 flex flex-wrap gap-2">
              <button type="submit" className="btn-secondary">Apply Filters</button>
              <Link href={`/admin/events/${event.id}/classes`} className="btn-secondary">
                Reset Filters
              </Link>
            </div>
          </form>

          {event.classTimeslots.length === 0 ? (
            <p className="text-sm text-slate-600">Add at least one timeslot before placing attendees.</p>
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {event.classTimeslots.map((timeslot) => {
                  const allRows = registrations.flatMap((registration) =>
                    registration.attendees.map((attendee) => {
                      const currentEnrollment =
                        attendee.rosterMember.classEnrollments.find(
                          (enrollment) =>
                            enrollment.offering.timeslotId === timeslot.id ||
                            enrollment.offering.timeslotId === null,
                        ) ?? null;
                      const currentWaitlist =
                        attendee.classWaitlistEntries.find((entry) => entry.timeslotId === timeslot.id) ?? null;

                      return {
                        currentEnrollment,
                        currentWaitlist,
                      };
                    }),
                  );
                  const totalSeats = timeslot.offerings.reduce(
                    (sum, offering) => sum + (offering.capacity ?? 0),
                    0,
                  );
                  const openSeats = timeslot.offerings.reduce(
                    (sum, offering) => sum + (getSeatsLeft(offering.capacity, offering._count.enrollments) ?? 0),
                    0,
                  );
                  const waitlisted = timeslot.offerings.reduce(
                    (sum, offering) => sum + offering.waitlistEntries.length,
                    0,
                  );
                  const unplaced = allRows.filter(
                    (row) => !row.currentEnrollment && !row.currentWaitlist,
                  ).length;

                  return (
                    <article key={`${timeslot.id}-overview`} className="workflow-card">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-base font-semibold text-slate-900">{timeslot.label}</h3>
                        <span className={getSlotHealthTone(unplaced, waitlisted)}>
                          {unplaced > 0 ? "Needs placement" : waitlisted > 0 ? "Watch waitlist" : "Slot healthy"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{formatTimeslotRange(timeslot.startsAt, timeslot.endsAt)}</p>
                      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-xl bg-white p-3">
                          <dt className="text-slate-500">Attendees</dt>
                          <dd className="mt-1 text-lg font-semibold text-slate-900">{allRows.length}</dd>
                        </div>
                        <div className="rounded-xl bg-white p-3">
                          <dt className="text-slate-500">Total seats</dt>
                          <dd className="mt-1 text-lg font-semibold text-slate-900">
                            {totalSeats > 0 ? totalSeats : "Open"}
                          </dd>
                        </div>
                        <div className="rounded-xl bg-white p-3">
                          <dt className="text-slate-500">Open seats</dt>
                          <dd className="mt-1 text-lg font-semibold text-emerald-700">{openSeats}</dd>
                        </div>
                        <div className="rounded-xl bg-white p-3">
                          <dt className="text-slate-500">Waitlisted</dt>
                          <dd className="mt-1 text-lg font-semibold text-amber-700">{waitlisted}</dd>
                        </div>
                        <div className="rounded-xl bg-white p-3 col-span-2">
                          <dt className="text-slate-500">Unplaced</dt>
                          <dd className="mt-1 text-lg font-semibold text-rose-700">{unplaced}</dd>
                        </div>
                      </dl>
                    </article>
                  );
                })}
              </div>

              {event.classTimeslots.map((timeslot) => (
              <section key={timeslot.id} className="space-y-4">
                {(() => {
                  const slotRows = registrations.flatMap((registration) =>
                    registration.attendees.map((attendee) => {
                      const currentEnrollment =
                        attendee.rosterMember.classEnrollments.find(
                          (enrollment) =>
                            enrollment.offering.timeslotId === timeslot.id ||
                            enrollment.offering.timeslotId === null,
                        ) ?? null;
                      const currentWaitlist =
                        attendee.classWaitlistEntries.find((entry) => entry.timeslotId === timeslot.id) ?? null;
                      const savedPreferences = attendee.classPreferences.filter(
                        (preference) => preference.timeslotId === timeslot.id,
                      );
                      const options = timeslot.offerings.map((offering) => {
                        const requirements = mapRequirementsToEvaluatorInput(offering.classCatalog.requirements);
                        const eligibility = evaluateClassRequirements(
                          {
                            ageAtStart: attendee.rosterMember.ageAtStart,
                            memberRole: attendee.rosterMember.memberRole,
                            masterGuide: attendee.rosterMember.masterGuide,
                            completedHonorCodes: attendee.rosterMember.completedRequirements
                              .map((item) => readHonorCodeFromMetadata(item.metadata))
                              .filter((item): item is string => Boolean(item)),
                          },
                          requirements,
                        );
                        const seatsLeft = getSeatsLeft(offering.capacity, offering._count.enrollments);
                        const preference = savedPreferences.find(
                          (candidate) => candidate.offering.id === offering.id,
                        );

                        return {
                          offering,
                          eligibility,
                          seatsLeft,
                          rank: preference?.rank ?? null,
                        };
                      });

                      const warnings = options
                        .filter((option) => !option.eligibility.eligible)
                        .map((option) => `${option.offering.classCatalog.code}: ${option.eligibility.blockers.join(", ")}`);
                      const blockerMessages = options.flatMap((option) => option.eligibility.blockers);
                      const suggestion = suggestPlacement(
                        options.map((option) => ({
                          offeringId: option.offering.id,
                          rank: option.rank,
                          eligible: option.eligibility.eligible,
                          seatsLeft: option.seatsLeft,
                        })),
                      );

                      return {
                        registration,
                        attendee,
                        currentEnrollment,
                        currentWaitlist,
                        savedPreferences,
                        options,
                        warnings,
                        hasAgeBlocker: blockerMessages.some((message) => isAgeBlockerMessage(message)),
                        hasPrerequisiteBlocker: blockerMessages.some((message) => !isAgeBlockerMessage(message)),
                        suggestion,
                      };
                    }),
                  );
                  const unplacedCount = slotRows.filter(
                    (row) => !row.currentEnrollment && !row.currentWaitlist,
                  ).length;
                  const filteredRows = slotRows.filter((row) => {
                    const matchesPlacement =
                      placementFilter === "all" ||
                      (placementFilter === "placed" && Boolean(row.currentEnrollment)) ||
                      (placementFilter === "unplaced" && !row.currentEnrollment && !row.currentWaitlist) ||
                      (placementFilter === "waitlisted" && Boolean(row.currentWaitlist));
                    const matchesBlocker =
                      blockerFilter === "all" ||
                      (blockerFilter === "age" && row.hasAgeBlocker) ||
                      (blockerFilter === "prerequisite" && row.hasPrerequisiteBlocker);
                    const matchesClub = clubFilter.length === 0 || row.registration.clubId === clubFilter;
                    const matchesRole =
                      roleFilter.length === 0 || row.attendee.rosterMember.memberRole === roleFilter;

                    return matchesPlacement && matchesBlocker && matchesClub && matchesRole;
                  });
                  const filteredUnplacedIds = filteredRows
                    .filter((row) => !row.currentEnrollment && !row.currentWaitlist)
                    .map((row) => row.attendee.id);
                  const allUnplacedIds = slotRows
                    .filter((row) => !row.currentEnrollment && !row.currentWaitlist)
                    .map((row) => row.attendee.id);
                  const filteredPlacementIds = filteredRows
                    .filter((row) => row.currentEnrollment)
                    .map((row) => row.attendee.id);
                  const filteredActionIds = filteredRows.map((row) => row.attendee.id);
                  const pressureOfferings = timeslot.offerings.filter((offering) => {
                    const pressure = getCapacityPressureLevel({
                      capacity: offering.capacity,
                      enrolledCount: offering._count.enrollments,
                      waitlistCount: offering.waitlistEntries.length,
                    });
                    return pressure.level !== "open";
                  });

                  return (
                    <>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">{timeslot.label}</h3>
                      <p className="text-sm text-slate-600">{formatTimeslotRange(timeslot.startsAt, timeslot.endsAt)}</p>
                    </div>
                    <span className={getSlotHealthTone(unplacedCount, filteredRows.filter((row) => row.currentWaitlist).length)}>
                      {unplacedCount} unplaced
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className={`rounded-full px-3 py-1 font-semibold ${unplacedCount > 0 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                      {unplacedCount} unplaced
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                      {timeslot.offerings.length} offerings
                    </span>
                    {pressureOfferings.map((offering) => {
                      const pressure = getCapacityPressureLevel({
                        capacity: offering.capacity,
                        enrolledCount: offering._count.enrollments,
                        waitlistCount: offering.waitlistEntries.length,
                      });

                      return (
                        <span
                          key={`${timeslot.id}-${offering.id}-pressure`}
                          className={`rounded-full px-3 py-1 font-semibold ${getPressureClasses(pressure.level)}`}
                        >
                          {offering.classCatalog.code}: {pressure.label}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 xl:grid-cols-[1.1fr,1fr,1fr]">
                  <div className="workflow-card-muted">
                    <h4 className="text-sm font-semibold text-slate-900">Filtered workload</h4>
                    <p className="mt-1 text-sm text-slate-600">
                      {filteredRows.length} attendee(s) match the current filters for this slot.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-rose-100 px-3 py-1 font-semibold text-rose-800">
                        {filteredUnplacedIds.length} filtered unplaced
                      </span>
                      <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-800">
                        {filteredRows.filter((row) => row.currentWaitlist).length} filtered waitlisted
                      </span>
                      <span className="rounded-full bg-sky-100 px-3 py-1 font-semibold text-sky-800">
                        {filteredRows.filter((row) => row.hasAgeBlocker || row.hasPrerequisiteBlocker).length} blocked
                      </span>
                    </div>
                  </div>

                  <form action={bulkAssignSuggestedTimeslotOfferings} className="space-y-3 rounded-xl bg-white p-4">
                    <input type="hidden" name="eventId" value={event.id} readOnly />
                    <input type="hidden" name="timeslotId" value={timeslot.id} readOnly />
                    {filteredUnplacedIds.map((attendeeId) => (
                      <input key={`${timeslot.id}-${attendeeId}-suggested`} type="hidden" name="registrationAttendeeIds" value={attendeeId} readOnly />
                    ))}
                    <h4 className="text-sm font-semibold text-slate-900">Suggested placement</h4>
                    <p className="text-xs text-slate-600">Use ranked, eligible, open-seat suggestions instead of assigning attendee by attendee.</p>
                    <div className="flex flex-wrap gap-2">
                      <button type="submit" className="btn-secondary" disabled={filteredUnplacedIds.length === 0}>
                        Assign Suggested for Filtered
                      </button>
                    </div>
                  </form>

                  <form action={bulkAssignSuggestedTimeslotOfferings} className="space-y-3 rounded-xl bg-white p-4">
                    <input type="hidden" name="eventId" value={event.id} readOnly />
                    <input type="hidden" name="timeslotId" value={timeslot.id} readOnly />
                    {allUnplacedIds.map((attendeeId) => (
                      <input key={`${timeslot.id}-${attendeeId}-all-unplaced`} type="hidden" name="registrationAttendeeIds" value={attendeeId} readOnly />
                    ))}
                    <h4 className="text-sm font-semibold text-slate-900">Whole-slot assist</h4>
                    <p className="text-xs text-slate-600">Run suggested placement for every currently unplaced attendee in this timeslot.</p>
                    <button type="submit" className="btn-secondary" disabled={allUnplacedIds.length === 0}>
                      Assign Suggested for All Unplaced
                    </button>
                  </form>

                  <div className="space-y-3 rounded-xl bg-white p-4">
                    <h4 className="text-sm font-semibold text-slate-900">Bulk placement changes</h4>
                    <form action={bulkClearTimeslotPlacements} className="space-y-2">
                      <input type="hidden" name="eventId" value={event.id} readOnly />
                      <input type="hidden" name="timeslotId" value={timeslot.id} readOnly />
                      {filteredPlacementIds.map((attendeeId) => (
                        <input key={`${timeslot.id}-${attendeeId}-clear`} type="hidden" name="registrationAttendeeIds" value={attendeeId} readOnly />
                      ))}
                      <label className="flex items-center gap-2 text-xs text-slate-600">
                        <input type="checkbox" name="autoPromoteSourceWaitlist" />
                        Auto-fill open seats from waitlists
                      </label>
                      <button type="submit" className="btn-secondary" disabled={filteredPlacementIds.length === 0}>
                        Bulk Clear Placements
                      </button>
                    </form>

                    <form action={bulkReassignTimeslotOfferings} className="space-y-2">
                      <input type="hidden" name="eventId" value={event.id} readOnly />
                      <input type="hidden" name="timeslotId" value={timeslot.id} readOnly />
                      {filteredActionIds.map((attendeeId) => (
                        <input key={`${timeslot.id}-${attendeeId}-reassign`} type="hidden" name="registrationAttendeeIds" value={attendeeId} readOnly />
                      ))}
                      <select name="eventClassOfferingId" required defaultValue="" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs">
                        <option value="" disabled>Choose target offering</option>
                        {timeslot.offerings.map((offering) => (
                          <option key={`${timeslot.id}-${offering.id}-bulk-option`} value={offering.id}>
                            {offering.classCatalog.title} ({offering.classCatalog.code})
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-2 text-xs text-slate-600">
                        <input type="checkbox" name="autoPromoteSourceWaitlist" />
                        Auto-fill seats opened by reassignment
                      </label>
                      <button type="submit" className="btn-secondary" disabled={filteredActionIds.length === 0}>
                        Bulk Reassign Filtered
                      </button>
                    </form>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">Club / Attendee</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">Preferences</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">Current</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">Warnings</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">Assist</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">Place</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredRows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
                            No attendees match the current filters for this timeslot.
                          </td>
                        </tr>
                      ) : filteredRows.map(
                        ({
                          registration,
                          attendee,
                          currentEnrollment,
                          currentWaitlist,
                          savedPreferences,
                          options,
                          warnings,
                          suggestion,
                        }) => (
                            <tr
                              key={`${timeslot.id}-${attendee.id}`}
                              className={!currentEnrollment && !currentWaitlist ? "bg-amber-50/60" : ""}
                            >
                              <td className="px-4 py-3 align-top text-slate-900">
                                <p className="font-semibold">{attendee.rosterMember.firstName} {attendee.rosterMember.lastName}</p>
                                <p className="text-xs text-slate-500">
                                  {registration.club.name} ({registration.club.code}) • {attendee.rosterMember.memberRole}
                                </p>
                              </td>
                              <td className="px-4 py-3 align-top text-slate-700">
                                {savedPreferences.length === 0 ? (
                                  <span className="text-xs text-slate-500">No preferences saved</span>
                                ) : (
                                  <ol className="space-y-1">
                                    {savedPreferences.map((preference) => (
                                      <li key={`${attendee.id}-${timeslot.id}-${preference.rank}`} className="text-xs">
                                        #{preference.rank} {preference.offering.classCatalog.title}
                                      </li>
                                    ))}
                                  </ol>
                                )}
                              </td>
                              <td className="px-4 py-3 align-top text-slate-700">
                                {currentEnrollment ? (
                                  <div className="space-y-1">
                                    <p>{currentEnrollment.offering.classCatalog.title}</p>
                                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                                      Placed
                                    </span>
                                  </div>
                                ) : currentWaitlist ? (
                                  <div className="space-y-1">
                                    <p>{currentWaitlist.offering.classCatalog.title}</p>
                                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                                      Waitlist #{currentWaitlist.position}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-800">Unplaced</span>
                                )}
                              </td>
                              <td className="px-4 py-3 align-top">
                                {warnings.length === 0 ? (
                                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">No blocker warnings</span>
                                ) : (
                                  <div className="space-y-1">
                                    {warnings.slice(0, 3).map((warning) => (
                                      <p key={warning} className="text-xs text-amber-800">{warning}</p>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 align-top">
                                <div className="space-y-2">
                                  {suggestion ? (
                                    <div className="rounded-lg border border-sky-200 bg-sky-50 p-2 text-xs text-sky-900">
                                      Suggest #{suggestion.rank ?? "?"}:{" "}
                                      {
                                        options.find((option) => option.offering.id === suggestion.offeringId)?.offering
                                          .classCatalog.title
                                      }
                                    </div>
                                  ) : (
                                    <p className="text-xs text-slate-500">No open ranked option available</p>
                                  )}

                                  {suggestion ? (
                                    <form action={assignSuggestedTimeslotOffering}>
                                      <input type="hidden" name="eventId" value={event.id} readOnly />
                                      <input type="hidden" name="timeslotId" value={timeslot.id} readOnly />
                                      <input type="hidden" name="registrationAttendeeId" value={attendee.id} readOnly />
                                      <input type="hidden" name="clubId" value={registration.clubId} readOnly />
                                      <button type="submit" className="btn-secondary">Assign Suggested</button>
                                    </form>
                                  ) : null}

                                  {!currentEnrollment ? (
                                    <>
                                      <form action={addAttendeeToClassWaitlist} className="space-y-2">
                                        <input type="hidden" name="eventId" value={event.id} readOnly />
                                        <input type="hidden" name="timeslotId" value={timeslot.id} readOnly />
                                        <input type="hidden" name="registrationAttendeeId" value={attendee.id} readOnly />
                                        <select
                                          name="eventClassOfferingId"
                                          required
                                          defaultValue={currentWaitlist?.eventClassOfferingId ?? ""}
                                          className="w-56 rounded-lg border border-slate-300 px-3 py-2 text-xs"
                                        >
                                          <option value="">Choose waitlist class</option>
                                          {options.map(({ offering }) => (
                                            <option key={`${attendee.id}-${offering.id}-waitlist`} value={offering.id}>
                                              {offering.classCatalog.title} ({offering.classCatalog.code})
                                            </option>
                                          ))}
                                        </select>
                                        <div>
                                          <button type="submit" className="btn-secondary">
                                            {currentWaitlist ? "Move Waitlist" : "Add Waitlist"}
                                          </button>
                                        </div>
                                      </form>
                                      {currentWaitlist ? (
                                        <form action={removeAttendeeFromClassWaitlist}>
                                          <input type="hidden" name="eventId" value={event.id} readOnly />
                                          <input type="hidden" name="waitlistEntryId" value={currentWaitlist.id} readOnly />
                                          <button type="submit" className="btn-secondary">Remove Waitlist</button>
                                        </form>
                                      ) : null}
                                    </>
                                  ) : null}
                                </div>
                              </td>
                              <td className="px-4 py-3 align-top">
                                <form action={assignAttendeeToTimeslotOffering} className="space-y-2">
                                  <input type="hidden" name="eventId" value={event.id} readOnly />
                                  <input type="hidden" name="timeslotId" value={timeslot.id} readOnly />
                                  <input type="hidden" name="clubId" value={registration.clubId} readOnly />
                                  <input type="hidden" name="rosterMemberId" value={attendee.rosterMemberId} readOnly />
                                  <select
                                    name="eventClassOfferingId"
                                    defaultValue={currentEnrollment?.eventClassOfferingId ?? ""}
                                    className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-xs"
                                  >
                                    <option value="">Unassigned</option>
                                    {options.map(({ offering, eligibility, seatsLeft, rank }) => {
                                      const blocked = !eligibility.eligible;

                                      return (
                                        <option key={offering.id} value={offering.id}>
                                          {offering.classCatalog.title} ({offering.classCatalog.code}){rank ? ` - pref #${rank}` : ""}{blocked ? " - warning" : ""}{seatsLeft !== null ? ` - ${seatsLeft} left` : ""}
                                        </option>
                                      );
                                    })}
                                  </select>
                                  <div>
                                    <button type="submit" className="btn-secondary">Save Placement</button>
                                  </div>
                                </form>
                              </td>
                            </tr>
                          ),
                      )}
                    </tbody>
                  </table>
                </div>
                    </>
                  );
                })()}
              </section>
            ))}
            </>
          )}
        </article>
      ) : null}
    </section>
  );
}
