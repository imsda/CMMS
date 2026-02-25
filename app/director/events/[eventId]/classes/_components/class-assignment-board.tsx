"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { type MemberRole } from "@prisma/client";

import { enrollAttendeeInClass } from "../../../../../actions/enrollment-actions";
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
  dayIndex: number;
  startsAt: string;
  endsAt: string;
  capacity: number;
  enrolledCount: number;
  requirements: RequirementInput[];
};

type SlotGroup = {
  slotKey: string;
  label: string;
  offerings: Offering[];
};

type OptimisticState = {
  enrolledCountsByOfferingId: Record<string, number>;
  attendeeEnrollmentsById: Record<string, string[]>;
};

type ClassAssignmentBoardProps = {
  eventId: string;
  attendees: Attendee[];
  slotGroups: SlotGroup[];
};

function fullName(attendee: Attendee) {
  return `${attendee.firstName} ${attendee.lastName}`;
}

function formatTimeRange(startsAtIso: string, endsAtIso: string) {
  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${timeFormatter.format(new Date(startsAtIso))} - ${timeFormatter.format(new Date(endsAtIso))}`;
}

function formatDayLabel(dayIndex: number) {
  return `Day ${dayIndex + 1}`;
}

export function ClassAssignmentBoard({ eventId, attendees, slotGroups }: ClassAssignmentBoardProps) {
  const [selectedAttendeeId, setSelectedAttendeeId] = useState<string>(attendees[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const baseOptimisticState = useMemo<OptimisticState>(
    () => ({
      enrolledCountsByOfferingId: Object.fromEntries(slotGroups.flatMap((slot) => slot.offerings.map((offering) => [offering.id, offering.enrolledCount]))),
      attendeeEnrollmentsById: Object.fromEntries(attendees.map((attendee) => [attendee.id, attendee.enrolledOfferingIds])),
    }),
    [attendees, slotGroups],
  );

  const [optimisticState, addOptimisticEnrollment] = useOptimistic(
    baseOptimisticState,
    (currentState, optimisticEnrollment: { attendeeId: string; offeringId: string }) => {
      const attendeeEnrollmentSet = new Set(currentState.attendeeEnrollmentsById[optimisticEnrollment.attendeeId] ?? []);
      if (attendeeEnrollmentSet.has(optimisticEnrollment.offeringId)) {
        return currentState;
      }

      attendeeEnrollmentSet.add(optimisticEnrollment.offeringId);

      return {
        enrolledCountsByOfferingId: {
          ...currentState.enrolledCountsByOfferingId,
          [optimisticEnrollment.offeringId]: (currentState.enrolledCountsByOfferingId[optimisticEnrollment.offeringId] ?? 0) + 1,
        },
        attendeeEnrollmentsById: {
          ...currentState.attendeeEnrollmentsById,
          [optimisticEnrollment.attendeeId]: Array.from(attendeeEnrollmentSet),
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
      <aside className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Registered Attendees</h2>
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
                className={`w-full rounded-xl border px-3 py-2 text-left ${
                  isSelected
                    ? "border-indigo-300 bg-indigo-50 text-indigo-900"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <p className="text-sm font-semibold">{fullName(attendee)}</p>
                <p className="text-xs text-slate-500">
                  {attendee.memberRole} • Age {attendee.ageAtStart ?? "N/A"} • {enrolledCount} classes
                </p>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="space-y-4">
        <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">Class Enrollment & Live Capacity</h1>
          <p className="mt-1 text-sm text-slate-600">
            {selectedAttendee
              ? `Assigning classes for ${fullName(selectedAttendee)}.`
              : "Select an attendee to start assigning classes."}
          </p>
          {errorMessage ? (
            <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorMessage}</p>
          ) : null}
        </header>

        {slotGroups.map((slotGroup) => (
          <article key={slotGroup.slotKey} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">{slotGroup.label}</h3>

            <div className="mt-3 grid gap-3 xl:grid-cols-2">
              {slotGroup.offerings.map((offering) => {
                const enrolledCount = optimisticState.enrolledCountsByOfferingId[offering.id] ?? offering.enrolledCount;
                const seatsLeft = Math.max(offering.capacity - enrolledCount, 0);
                const isFull = seatsLeft <= 0;
                const alreadyEnrolled =
                  selectedAttendee !== null &&
                  (optimisticState.attendeeEnrollmentsById[selectedAttendee.id] ?? []).includes(offering.id);
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
                    : isFull
                      ? "Class full"
                      : null;

                return (
                  <div key={offering.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {offering.title} <span className="text-xs font-medium text-slate-500">({offering.code})</span>
                        </p>
                        <p className="text-xs text-slate-600">
                          {formatDayLabel(offering.dayIndex)} • {formatTimeRange(offering.startsAt, offering.endsAt)}
                        </p>
                        <p className="text-xs text-slate-500">{offering.location ?? "Location TBD"}</p>
                      </div>
                      <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                        {seatsLeft}/{offering.capacity} seats left
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {offering.requirements.map((requirement, index) => (
                        <span
                          key={`${offering.id}-req-${index}`}
                          className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700"
                        >
                          {requirementToBadgeLabel(requirement)}
                        </span>
                      ))}
                      {blockedReason ? (
                        <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700">
                          {blockedReason}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-4">
                      <button
                        type="button"
                        disabled={isPending || !selectedAttendee || !eligibility.eligible || alreadyEnrolled || isFull}
                        onClick={() => {
                          if (!selectedAttendee) {
                            return;
                          }

                          setErrorMessage(null);
                          addOptimisticEnrollment({
                            attendeeId: selectedAttendee.id,
                            offeringId: offering.id,
                          });

                          startTransition(async () => {
                            try {
                              await enrollAttendeeInClass({
                                eventId,
                                rosterMemberId: selectedAttendee.id,
                                eventClassOfferingId: offering.id,
                              });
                            } catch (error) {
                              const message = error instanceof Error ? error.message : "Unable to enroll attendee.";
                              setErrorMessage(message);
                            }
                          });
                        }}
                        className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {alreadyEnrolled ? "Enrolled" : "Enroll"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
