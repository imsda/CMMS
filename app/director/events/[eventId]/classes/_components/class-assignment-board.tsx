"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { type MemberRole } from "@prisma/client";

import { enrollAttendeeInClass, removeAttendeeFromClass } from "../../../../../actions/enrollment-actions";
import {
  CLASS_ASSIGNMENT_POLICY,
  getSeatsLeft,
  isOfferingFull,
} from "../../../../../../lib/class-model";
import {
  evaluateClassRequirements,
  requirementToBadgeLabel,
  type RequirementInput,
} from "../../../../../../lib/class-prerequisite-utils";

type Attendee = {
  id: string;
  firstName: string;
  lastName: string;
  ageAtStart: number | null;
  memberRole: MemberRole;
  masterGuide: boolean;
  completedHonorCodes: string[];
  enrolledOfferingIds: string[];
};

type Offering = {
  id: string;
  title: string;
  code: string;
  location: string | null;
  capacity: number | null;
  enrolledCount: number;
  requirements: RequirementInput[];
};

type OptimisticState = {
  enrolledCountsByOfferingId: Record<string, number>;
  attendeeEnrollmentsById: Record<string, string[]>;
};

type OptimisticAction =
  | {
      kind: "enroll";
      attendeeId: string;
      offeringId: string;
    }
  | {
      kind: "remove";
      attendeeId: string;
      offeringId: string;
    };

type ClassAssignmentBoardProps = {
  eventId: string;
  managedClubId: string | null;
  attendees: Attendee[];
  offerings: Offering[];
};

function fullName(attendee: Attendee) {
  return `${attendee.firstName} ${attendee.lastName}`;
}

function formatAssignmentCount(count: number) {
  if (count === 0) {
    return "No class assigned";
  }

  return "1 class assigned";
}

export function ClassAssignmentBoard({ eventId, managedClubId, attendees, offerings }: ClassAssignmentBoardProps) {
  const [selectedAttendeeId, setSelectedAttendeeId] = useState<string>(attendees[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const baseOptimisticState = useMemo<OptimisticState>(
    () => ({
      enrolledCountsByOfferingId: Object.fromEntries(
        offerings.map((offering) => [offering.id, offering.enrolledCount]),
      ),
      attendeeEnrollmentsById: Object.fromEntries(attendees.map((attendee) => [attendee.id, attendee.enrolledOfferingIds])),
    }),
    [attendees, offerings],
  );

  const [optimisticState, addOptimisticEnrollment] = useOptimistic(
    baseOptimisticState,
    (currentState, optimisticAction: OptimisticAction) => {
      const attendeeEnrollmentSet = new Set(
        currentState.attendeeEnrollmentsById[optimisticAction.attendeeId] ?? [],
      );

      if (optimisticAction.kind === "enroll") {
        if (attendeeEnrollmentSet.has(optimisticAction.offeringId)) {
          return currentState;
        }

        attendeeEnrollmentSet.add(optimisticAction.offeringId);

        return {
          enrolledCountsByOfferingId: {
            ...currentState.enrolledCountsByOfferingId,
            [optimisticAction.offeringId]:
              (currentState.enrolledCountsByOfferingId[optimisticAction.offeringId] ?? 0) + 1,
          },
          attendeeEnrollmentsById: {
            ...currentState.attendeeEnrollmentsById,
            [optimisticAction.attendeeId]: Array.from(attendeeEnrollmentSet),
          },
        };
      }

      if (!attendeeEnrollmentSet.has(optimisticAction.offeringId)) {
        return currentState;
      }

      attendeeEnrollmentSet.delete(optimisticAction.offeringId);

      return {
        enrolledCountsByOfferingId: {
          ...currentState.enrolledCountsByOfferingId,
          [optimisticAction.offeringId]: Math.max(
            (currentState.enrolledCountsByOfferingId[optimisticAction.offeringId] ?? 1) - 1,
            0,
          ),
        },
        attendeeEnrollmentsById: {
          ...currentState.attendeeEnrollmentsById,
          [optimisticAction.attendeeId]: Array.from(attendeeEnrollmentSet),
        },
      };
    },
  );

  const selectedAttendee = useMemo(
    () => attendees.find((attendee) => attendee.id === selectedAttendeeId) ?? null,
    [attendees, selectedAttendeeId],
  );

  return (
    <section className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="glass-sidebar space-y-3">
        <h2 className="section-title">Registered Attendees</h2>
        <p className="text-xs text-slate-600">Choose an attendee, then enroll them into available classes.</p>

        <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
          {attendees.map((attendee) => {
            const isSelected = attendee.id === selectedAttendeeId;
            const enrolledCount = optimisticState.attendeeEnrollmentsById[attendee.id]?.length ?? 0;

            return (
              <button
                key={attendee.id}
                type="button"
                onClick={() => setSelectedAttendeeId(attendee.id)}
                className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                  isSelected
                    ? "border-indigo-300 bg-indigo-50/70 text-indigo-900"
                    : "border-white/50 bg-white/55 text-slate-700 hover:bg-white/75"
                }`}
              >
                <p className="text-sm font-semibold">{fullName(attendee)}</p>
                <p className="text-xs text-slate-500">
                  {attendee.memberRole} • Age {attendee.ageAtStart ?? "N/A"} • {formatAssignmentCount(enrolledCount)}
                </p>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="space-y-4">
        <header className="glass-panel">
          <h1 className="section-title">Class Enrollment & Live Capacity</h1>
          <p className="section-copy">
            {selectedAttendee
              ? `Assigning classes for ${fullName(selectedAttendee)}.`
              : "Select an attendee to start assigning classes."}
          </p>
          <p className="mt-1 text-xs font-medium text-slate-500">{CLASS_ASSIGNMENT_POLICY}</p>
          {errorMessage ? (
            <p className="alert-danger mt-4">{errorMessage}</p>
          ) : null}
        </header>

        <article className="glass-panel">
          <div className="grid gap-3 xl:grid-cols-2">
            {offerings.map((offering) => {
              const enrolledCount =
                optimisticState.enrolledCountsByOfferingId[offering.id] ?? offering.enrolledCount;
              const seatsLeft = getSeatsLeft(offering.capacity, enrolledCount);
              const isFull = isOfferingFull(offering.capacity, enrolledCount);
              const alreadyEnrolled =
                selectedAttendee !== null &&
                (optimisticState.attendeeEnrollmentsById[selectedAttendee.id] ?? []).includes(offering.id);
              const hasOtherEnrollment =
                selectedAttendee !== null &&
                (optimisticState.attendeeEnrollmentsById[selectedAttendee.id] ?? []).some(
                  (enrolledOfferingId) => enrolledOfferingId !== offering.id,
                );
              const eligibility = selectedAttendee
                ? evaluateClassRequirements(
                    {
                      ageAtStart: selectedAttendee.ageAtStart,
                      memberRole: selectedAttendee.memberRole,
                      masterGuide: selectedAttendee.masterGuide,
                      completedHonorCodes: selectedAttendee.completedHonorCodes,
                    },
                    offering.requirements,
                  )
                : { eligible: false, blockers: ["Select an attendee"] };

              const blockedReason = !eligibility.eligible
                ? eligibility.blockers[0]
                : alreadyEnrolled
                  ? "Already enrolled"
                  : hasOtherEnrollment
                    ? "Already assigned to another event class"
                    : isFull
                      ? "Class full"
                      : null;

              return (
                <div key={offering.id} className="glass-card-soft">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {offering.title} <span className="text-xs font-medium text-slate-500">({offering.code})</span>
                      </p>
                      <p className="text-xs text-slate-500">{offering.location ?? "Location TBD"}</p>
                    </div>
                    <span className="status-chip-neutral bg-slate-900/90 text-white">
                      {seatsLeft === null ? "Open capacity" : `${seatsLeft}/${offering.capacity} seats left`}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {offering.requirements.map((requirement, index) => (
                      <span
                        key={`${offering.id}-req-${index}`}
                        className="status-chip-warning"
                      >
                        {requirementToBadgeLabel(requirement)}
                      </span>
                    ))}
                    {blockedReason ? (
                      <span className="status-chip-danger">
                        {blockedReason}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4">
                    <button
                      type="button"
                      disabled={
                        isPending ||
                        !selectedAttendee ||
                        !eligibility.eligible ||
                        alreadyEnrolled ||
                        hasOtherEnrollment ||
                        isFull
                      }
                      onClick={() => {
                        if (!selectedAttendee) {
                          return;
                        }

                        setErrorMessage(null);
                        addOptimisticEnrollment({
                          kind: "enroll",
                          attendeeId: selectedAttendee.id,
                          offeringId: offering.id,
                        });

                        startTransition(async () => {
                          try {
                            await enrollAttendeeInClass({
                              eventId,
                              rosterMemberId: selectedAttendee.id,
                              eventClassOfferingId: offering.id,
                              clubId: managedClubId,
                            });
                          } catch (error) {
                            const message =
                              error instanceof Error ? error.message : "Unable to enroll attendee.";
                            setErrorMessage(message);
                          }
                        });
                      }}
                      className="btn-primary px-3 py-2 disabled:bg-slate-300"
                    >
                      {alreadyEnrolled ? "Enrolled" : "Enroll"}
                    </button>

                    {alreadyEnrolled ? (
                      <button
                        type="button"
                        disabled={isPending || !selectedAttendee}
                        onClick={() => {
                          if (!selectedAttendee) {
                            return;
                          }

                          setErrorMessage(null);
                          addOptimisticEnrollment({
                            kind: "remove",
                            attendeeId: selectedAttendee.id,
                            offeringId: offering.id,
                          });

                          startTransition(async () => {
                            try {
                              await removeAttendeeFromClass({
                                eventId,
                                rosterMemberId: selectedAttendee.id,
                                eventClassOfferingId: offering.id,
                                clubId: managedClubId,
                              });
                            } catch (error) {
                              const message =
                                error instanceof Error ? error.message : "Unable to remove enrollment.";
                              setErrorMessage(message);
                            }
                          });
                        }}
                        className="btn-secondary ml-2 px-3 py-2"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </div>
    </section>
  );
}
