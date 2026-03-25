import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getDirectorCamporeeSummary } from "../../../actions/camporee-actions";
import { getDirectorCamporeeRegistrationSnapshot } from "../../../actions/camporee-registration-actions";
import { isCamporeeWorkflowEvent } from "../../../../lib/camporee-workflow";
import { getManagedClubContext } from "../../../../lib/club-management";
import { getEventModeConfig } from "../../../../lib/event-modes";
import { getRegistrationLifecycleState } from "../../../../lib/registration-lifecycle";
import { decryptMedicalFields } from "../../../../lib/medical-data";
import { prisma } from "../../../../lib/prisma";
import { buildDirectorPath } from "../../../../lib/director-path";
import { CamporeeRegistrationWorkflow } from "./_components/camporee-registration-workflow";
import { RegistrationFormFulfiller } from "./_components/registration-form-fulfiller";

function formatDateRange(startsAt: Date, endsAt: Date, locale: string) {
  const formatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return `${formatter.format(startsAt)} - ${formatter.format(endsAt)}`;
}

function formatCurrency(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export default async function DirectorEventRegistrationPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams?: Promise<{ clubId?: string }>;
}) {
  const t = await getTranslations("Director");
  const locale = await getLocale();
  const { eventId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const managedClub = await getManagedClubContext(resolvedSearchParams?.clubId ?? null);

  const club = await prisma.club.findUnique({
    where: {
      id: managedClub.clubId,
    },
    include: {
      rosterYears: {
        where: {
          isActive: true,
        },
        include: {
          members: {
            where: {
              isActive: true,
            },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              memberRole: true,
              dietaryRestrictions: true,
              medicalFlags: true,
              emergencyContactName: true,
              emergencyContactPhone: true,
            },
            orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          },
        },
        orderBy: {
          startsOn: "desc",
        },
        take: 1,
      },
    },
  });

  if (!club) {
    return (
      <section className="glass-panel">
        <h1 className="text-xl font-semibold">{t("common.clubNotFound")}</h1>
        <p className="mt-2 text-sm">{t("eventDetail.clubNotFoundDescription")}</p>
      </section>
    );
  }

  const event = await prisma.event.findUnique({
    where: {
      id: eventId,
    },
    include: {
      dynamicFields: {
        orderBy: {
          sortOrder: "asc",
        },
      },
      registrations: {
        where: {
          clubId: club.id,
        },
        include: {
          attendees: {
            select: {
              rosterMemberId: true,
              classPreferences: {
                where: {
                  eventId,
                },
                select: {
                  id: true,
                },
              },
              rosterMember: {
                select: {
                  classEnrollments: {
                    where: {
                      offering: {
                        eventId,
                      },
                    },
                    select: {
                      id: true,
                    },
                  },
                },
              },
            },
          },
          formResponses: {
            select: {
              attendeeId: true,
              eventFormFieldId: true,
              value: true,
            },
          },
        },
        take: 1,
      },
    },
  });

  if (!event) {
    notFound();
  }

  const registration = event.registrations[0] ?? null;
  const paymentStatus = registration?.paymentStatus ?? null;
  const squareCheckoutUrl = registration?.squareCheckoutUrl ?? null;
  const activeRoster = club.rosterYears[0];
  const attendees = activeRoster?.members ?? [];
  const attendeeMedicalSummaries = attendees.map((member) => {
    const decrypted = decryptMedicalFields({
      medicalFlags: member.medicalFlags,
      dietaryRestrictions: member.dietaryRestrictions,
    });
    return {
      id: member.id,
      dietaryRestrictions: decrypted.dietaryRestrictions,
      medicalNotes: decrypted.medicalFlags,
      emergencyContactName: member.emergencyContactName ?? null,
      emergencyContactPhone: member.emergencyContactPhone ?? null,
    };
  });
  const attendeeCount = registration?.attendees.length ?? 0;
  const inLateFeeWindow = new Date() >= event.lateFeeStartsAt;
  const currentPricePerAttendee = inLateFeeWindow ? event.lateFeePrice : event.basePrice;
  const estimatedTotal = attendeeCount * currentPricePerAttendee;
  const camporeeSummary = await getDirectorCamporeeSummary(eventId, managedClub.clubId);
  const camporeeWorkflowEnabled = isCamporeeWorkflowEvent(event);
  const eventModeConfig = getEventModeConfig(event.eventMode);
  const lifecycleState = getRegistrationLifecycleState({
    registrationOpensAt: event.registrationOpensAt,
    registrationClosesAt: event.registrationClosesAt,
    registrationStatus: registration?.status ?? null,
  });
  const camporeeRegistrationSnapshot = camporeeWorkflowEnabled
    ? await getDirectorCamporeeRegistrationSnapshot(eventId, managedClub.clubId)
    : null;

  return (
    <section className="space-y-6">
      <header className="glass-panel">
        <p className="hero-kicker">{t("eventDetail.eyebrow")}</p>
        <h1 className="hero-title mt-3">{event.name}</h1>
        <p className="hero-copy">{event.description ?? t("eventDetail.noDescription")}</p>
        <p className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {eventModeConfig.label}
        </p>
        <p className="mt-3 text-sm text-slate-600">{eventModeConfig.description}</p>

        <dl className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
          <div>
            <dt className="font-semibold text-slate-900">{t("eventDetail.when")}</dt>
            <dd>{formatDateRange(event.startsAt, event.endsAt, locale)}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-900">{t("eventDetail.registrationWindow")}</dt>
            <dd>{formatDateRange(event.registrationOpensAt, event.registrationClosesAt, locale)}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-900">{t("eventDetail.location")}</dt>
            <dd>{event.locationName ?? t("common.locationTbd")}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-900">{t("eventDetail.address")}</dt>
            <dd>{event.locationAddress ?? t("common.locationTbd")}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-900">{t("eventDetail.currentPrice")}</dt>
            <dd>{formatCurrency(currentPricePerAttendee, locale)}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-900">{t("eventDetail.estimatedTotal")}</dt>
            <dd>{formatCurrency(estimatedTotal, locale)} ({t("common.attendeesCount", { count: attendeeCount })})</dd>
          </div>
        </dl>
      </header>

      {(event.minAttendeeAge !== null || event.maxAttendeeAge !== null || event.allowedClubTypes.length > 0) ? (
        <article className="glass-panel">
          <h2 className="text-base font-semibold text-slate-900">{t("eventDetail.eligibility.title")}</h2>
          <dl className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-3">
            {event.minAttendeeAge !== null ? (
              <div>
                <dt className="font-semibold text-slate-900">{t("eventDetail.eligibility.minAge")}</dt>
                <dd>{event.minAttendeeAge}</dd>
              </div>
            ) : null}
            {event.maxAttendeeAge !== null ? (
              <div>
                <dt className="font-semibold text-slate-900">{t("eventDetail.eligibility.maxAge")}</dt>
                <dd>{event.maxAttendeeAge}</dd>
              </div>
            ) : null}
            {event.allowedClubTypes.length > 0 ? (
              <div>
                <dt className="font-semibold text-slate-900">{t("eventDetail.eligibility.clubTypes")}</dt>
                <dd>{event.allowedClubTypes.join(", ")}</dd>
              </div>
            ) : null}
          </dl>
          <p className="mt-2 text-xs text-slate-500">{t("eventDetail.eligibility.warningNote")}</p>
        </article>
      ) : null}

      {paymentStatus !== null ? (
        <article className="glass-panel">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">{t("eventDetail.payment.statusLabel")}</p>
              <p
                className={[
                  "mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                  paymentStatus === "PAID"
                    ? "bg-emerald-100 text-emerald-800"
                    : paymentStatus === "PARTIAL"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-slate-100 text-slate-700",
                ].join(" ")}
              >
                {paymentStatus === "PAID" ? (
                  <span aria-hidden="true">✓</span>
                ) : (
                  <span aria-hidden="true">○</span>
                )}
                {t(`eventDetail.payment.status.${paymentStatus}`)}
              </p>
            </div>
            {paymentStatus !== "PAID" && squareCheckoutUrl ? (
              <a
                href={squareCheckoutUrl}
                className="btn-primary"
                rel="noopener noreferrer"
              >
                {t("eventDetail.payment.completePayment")}
              </a>
            ) : null}
          </div>
        </article>
      ) : null}

      {event.eventMode === "CLASS_ASSIGNMENT" ? (
        <article className="glass-panel flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{t("classes.eyebrow")}</h2>
            <p className="mt-1 text-sm text-slate-600">{t("classes.description")}</p>
          </div>
          <Link
            href={buildDirectorPath(`/director/events/${event.id}/classes`, managedClub.clubId, managedClub.isSuperAdmin)}
            className="btn-secondary"
          >
            {t("classes.board.enrollmentTitle")}
          </Link>
        </article>
      ) : null}

      {camporeeSummary && camporeeSummary.scores.length > 0 ? (
        <article className="glass-panel">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="hero-kicker">{t("eventDetail.camporeeEyebrow")}</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">{t("eventDetail.camporeeTitle")}</h2>
              <p className="mt-1 text-sm text-slate-600">
                {t("eventDetail.camporeeDescription")}
              </p>
            </div>
            <div className="rounded-xl bg-amber-50 px-4 py-3 text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">{t("eventDetail.totalScore")}</p>
              <p className="text-3xl font-semibold text-amber-900">{camporeeSummary.totalScore}</p>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3">{t("eventDetail.table.category")}</th>
                  <th className="px-4 py-3">{t("eventDetail.table.score")}</th>
                  <th className="px-4 py-3">{t("eventDetail.table.notes")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {camporeeSummary.scores.map((score) => (
                  <tr key={`${camporeeSummary.registrationId}-${score.category}`}>
                    <td className="px-4 py-3 text-slate-900">{score.category}</td>
                    <td className="px-4 py-3 text-slate-700">{score.score}</td>
                    <td className="px-4 py-3 text-slate-600">{score.notes ?? t("common.none")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      ) : null}

      {camporeeWorkflowEnabled && camporeeRegistrationSnapshot ? (
        <CamporeeRegistrationWorkflow
          eventId={event.id}
          managedClubId={managedClub.isSuperAdmin ? managedClub.clubId : null}
          attendees={attendees.map((member) => ({
            id: member.id,
            firstName: member.firstName,
            lastName: member.lastName,
            memberRole: member.memberRole,
          }))}
          attendeeMedicalSummaries={attendeeMedicalSummaries}
          initialPayload={camporeeRegistrationSnapshot.existingPayload}
          dynamicFields={event.dynamicFields
            .filter((field) => field.type !== "FIELD_GROUP")
            .map((field) => ({
              id: field.id,
              key: field.key,
              label: field.label,
              description: field.description,
              type: field.type,
              isRequired: field.isRequired,
              options: field.options,
            }))}
          dynamicResponses={camporeeRegistrationSnapshot.dynamicResponses}
          registrationStatus={registration?.status ?? null}
          canEditRegistration={lifecycleState.canEdit}
          registrationNotice={lifecycleState.message}
          reviewerNotes={camporeeRegistrationSnapshot.reviewerNotes}
          revisionRequestedReason={camporeeRegistrationSnapshot.revisionRequestedReason}
        />
      ) : (
        <RegistrationFormFulfiller
          eventId={event.id}
          eventName={event.name}
          eventMode={event.eventMode}
          managedClubId={managedClub.isSuperAdmin ? managedClub.clubId : null}
          attendees={attendees.map((member) => ({
            id: member.id,
            firstName: member.firstName,
            lastName: member.lastName,
            memberRole: member.memberRole,
          }))}
          dynamicFields={event.dynamicFields.map((field) => ({
            id: field.id,
            key: field.key,
            label: field.label,
            description: field.description,
            type: field.type,
            fieldScope: field.fieldScope,
            isRequired: field.isRequired,
            options: field.options,
            parentFieldId: field.parentFieldId,
          }))}
          initialSelectedAttendeeIds={registration?.attendees.map((attendee) => attendee.rosterMemberId) ?? []}
          initialResponses={
            registration?.formResponses.map((response) => ({
              fieldId: response.eventFormFieldId,
              attendeeId: response.attendeeId,
              value: response.value,
            })) ?? []
          }
          registrationStatus={registration?.status ?? null}
          canEditRegistration={lifecycleState.canEdit}
          registrationNotice={lifecycleState.message}
          pricePerAttendee={currentPricePerAttendee}
          classesHref={
            event.eventMode === "CLASS_ASSIGNMENT"
              ? buildDirectorPath(`/director/events/${event.id}/classes`, managedClub.clubId, managedClub.isSuperAdmin)
              : null
          }
          classAssignmentCoveredAttendeeIds={
            registration?.attendees
              .filter((attendee) => attendee.classPreferences.length > 0 || attendee.rosterMember.classEnrollments.length > 0)
              .map((attendee) => attendee.rosterMemberId) ?? []
          }
        />
      )}
    </section>
  );
}
