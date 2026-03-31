"use client";

import { useState, useTransition } from "react";
import type { MemberRole, RequirementType } from "@prisma/client";

import { saveRankedClassPreferences, saveAllClassPreferences } from "../../../../actions/honors-actions";
import { CLASS_ASSIGNMENT_POLICY, getSeatsLeft } from "../../../../../lib/class-model";
import {
  evaluateClassRequirements,
  requirementToBadgeLabel,
  type RequirementInput,
} from "../../../../../lib/class-prerequisite-utils";

// ---------- Types ----------

type RequirementShape = {
  requirementType: RequirementType;
  minAge: number | null;
  maxAge: number | null;
  requiredMemberRole: MemberRole | null;
  requiredHonorCode: string | null;
  requiredMasterGuide: boolean | null;
};

type OfferingShape = {
  id: string;
  capacity: number | null;
  locationName: string | null;
  classCatalog: {
    title: string;
    code: string;
    description: string | null;
    requirements: RequirementShape[];
  };
  enrolledCount: number;
};

type TimeslotShape = {
  id: string;
  label: string;
  startsAt: string | Date;
  endsAt: string | Date;
  offerings: OfferingShape[];
};

type AttendeeShape = {
  id: string;
  rosterMemberId: string;
  rosterMember: {
    firstName: string;
    lastName: string;
    ageAtStart: number | null;
    memberRole: MemberRole;
    masterGuide: boolean;
    completedHonorCodes: string[];
    currentEnrollments: Array<{
      timeslotId: string | null;
      classTitle: string;
    }>;
  };
  savedPreferences: Record<string, string[]>; // timeslotId -> offeringIds[]
};

type Props = {
  eventId: string;
  eventName: string;
  registrationId: string;
  clubId: string | null;
  isSuperAdmin: boolean;
  classTimeslots: TimeslotShape[];
  attendees: AttendeeShape[];
};

// ---------- Helpers ----------

function formatTimeslotRange(startsAt: string | Date, endsAt: string | Date) {
  const start = typeof startsAt === "string" ? new Date(startsAt) : startsAt;
  const end = typeof endsAt === "string" ? new Date(endsAt) : endsAt;

  const formatter = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

function selKey(attendeeId: string, timeslotId: string) {
  return `${attendeeId}:${timeslotId}`;
}

function areSame(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

// ---------- Component ----------

export function ClassAssignmentBoardClient({
  eventId,
  eventName,
  registrationId,
  clubId,
  isSuperAdmin,
  classTimeslots,
  attendees,
}: Props) {
  // Build initial selections from saved preferences
  const buildInitial = () => {
    const map: Record<string, string[]> = {};
    for (const attendee of attendees) {
      for (const timeslot of classTimeslots) {
        map[selKey(attendee.id, timeslot.id)] = attendee.savedPreferences[timeslot.id] ?? [];
      }
    }
    return map;
  };

  const [selections, setSelections] = useState<Record<string, string[]>>(buildInitial);
  const [persisted, setPersisted] = useState<Record<string, string[]>>(buildInitial);

  const [isSavingAll, startSaveAll] = useTransition();
  const [saveAllError, setSaveAllError] = useState<string | null>(null);
  const [saveAllSuccess, setSaveAllSuccess] = useState(false);

  // Per-row save state: key -> "saving" | "saved" | "error"
  const [rowSaveState, setRowSaveState] = useState<Record<string, "saving" | "saved" | "error">>({});

  const isDirty = (attendeeId: string, timeslotId: string) => {
    const key = selKey(attendeeId, timeslotId);
    return !areSame(selections[key] ?? [], persisted[key] ?? []);
  };

  const handleSelectionChange = (attendeeId: string, timeslotId: string, index: number, value: string) => {
    const key = selKey(attendeeId, timeslotId);
    const current = [...(selections[key] ?? [])];
    // Pad if needed
    while (current.length <= index) current.push("");
    current[index] = value;
    // Remove trailing empties, but keep the slot
    setSelections((prev) => ({ ...prev, [key]: current }));
    setSaveAllSuccess(false);
    setSaveAllError(null);
  };

  const handleSaveRow = (attendeeId: string, timeslotId: string) => {
    const key = selKey(attendeeId, timeslotId);
    const offeringIds = (selections[key] ?? []).filter((id) => id.length > 0);

    setRowSaveState((prev) => ({ ...prev, [key]: "saving" }));

    const formData = new FormData();
    formData.set("eventId", eventId);
    formData.set("timeslotId", timeslotId);
    formData.set("registrationAttendeeId", attendeeId);
    if (isSuperAdmin && clubId) formData.set("clubId", clubId);
    for (const id of offeringIds) formData.append("preferenceOfferingIds", id);

    void saveRankedClassPreferences(formData).then(
      () => {
        setPersisted((prev) => ({ ...prev, [key]: offeringIds }));
        setRowSaveState((prev) => ({ ...prev, [key]: "saved" }));
      },
      () => {
        setRowSaveState((prev) => ({ ...prev, [key]: "error" }));
      },
    );
  };

  const handleSaveAll = () => {
    setSaveAllError(null);
    setSaveAllSuccess(false);

    startSaveAll(async () => {
      const preferences = attendees.flatMap((attendee) =>
        classTimeslots.map((timeslot) => {
          const key = selKey(attendee.id, timeslot.id);
          return {
            registrationAttendeeId: attendee.id,
            timeslotId: timeslot.id,
            offeringIds: (selections[key] ?? []).filter((id) => id.length > 0),
          };
        }),
      );

      try {
        await saveAllClassPreferences({
          eventId,
          registrationId,
          clubId: isSuperAdmin ? clubId : null,
          preferences,
        });

        // Mark everything as persisted
        const next: Record<string, string[]> = {};
        for (const pref of preferences) {
          next[selKey(pref.registrationAttendeeId, pref.timeslotId)] = pref.offeringIds;
        }
        setPersisted((prev) => ({ ...prev, ...next }));
        setRowSaveState({});
        setSaveAllSuccess(true);
      } catch (err) {
        setSaveAllError(err instanceof Error ? err.message : "Failed to save preferences.");
      }
    });
  };

  const hasDirtyRows = attendees.some((a) => classTimeslots.some((t) => isDirty(a.id, t.id)));

  const saveAllButton = (
    <button
      type="button"
      onClick={handleSaveAll}
      disabled={isSavingAll}
      className="btn-primary"
    >
      {isSavingAll ? "Saving…" : "Save All Preferences"}
    </button>
  );

  return (
    <section className="space-y-6">
      <header className="glass-panel">
        <p className="hero-kicker">Class Selection</p>
        <h1 className="hero-title mt-3">{eventName}</h1>
        <p className="hero-copy">
          Save ranked class choices for each attendee by timeslot. Conference admins can then balance final placement
          with capacity and prerequisite warnings in view.
        </p>
        <p className="mt-1 text-xs font-medium text-slate-500">{CLASS_ASSIGNMENT_POLICY}</p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {saveAllButton}
          {hasDirtyRows && !isSavingAll && (
            <span className="text-sm text-amber-600 font-medium">You have unsaved changes.</span>
          )}
          {saveAllSuccess && !hasDirtyRows && (
            <span className="text-sm text-emerald-600 font-medium">All preferences saved.</span>
          )}
          {saveAllError && <span className="text-sm text-red-600">{saveAllError}</span>}
        </div>
      </header>

      {classTimeslots.length === 0 ? (
        <article className="glass-panel text-sm text-slate-600">
          No class timeslots have been published for this event yet.
        </article>
      ) : (
        classTimeslots.map((timeslot) => (
          <article key={timeslot.id} className="glass-panel space-y-5">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">{timeslot.label}</h2>
              <p className="mt-1 text-sm text-slate-600">
                {formatTimeslotRange(timeslot.startsAt, timeslot.endsAt)}
              </p>
            </div>

            {/* Offerings grid */}
            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {timeslot.offerings.map((offering) => {
                const seatsLeft = getSeatsLeft(offering.capacity, offering.enrolledCount);
                const requirements = offering.classCatalog.requirements as RequirementInput[];

                return (
                  <div key={offering.id} className="rounded-2xl border border-white/60 bg-white/70 p-4">
                    <h3 className="text-sm font-semibold text-slate-900">
                      {offering.classCatalog.title}
                      <span className="ml-2 text-xs font-medium text-slate-500">
                        ({offering.classCatalog.code})
                      </span>
                    </h3>
                    {offering.classCatalog.description ? (
                      <p className="mt-1 text-xs text-slate-600">{offering.classCatalog.description}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-slate-500">{offering.locationName ?? "Location TBD"}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-700">
                      {seatsLeft === null ? "Open capacity" : `${seatsLeft} seat(s) left`}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {requirements.map((req, i) => (
                        <span key={`${offering.id}-${i}`} className="status-chip-warning">
                          {requirementToBadgeLabel(req)}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Attendee preference rows */}
            <div className="grid gap-4 xl:grid-cols-2">
              {attendees.map((attendee) => {
                const key = selKey(attendee.id, timeslot.id);
                const dirty = isDirty(attendee.id, timeslot.id);
                const rowState = rowSaveState[key];
                const currentEnrollment =
                  attendee.rosterMember.currentEnrollments.find(
                    (e) => e.timeslotId === timeslot.id || e.timeslotId === null,
                  ) ?? null;
                const currentSelections = selections[key] ?? [];

                return (
                  <div
                    key={`${timeslot.id}-${attendee.id}`}
                    className="rounded-2xl border border-white/60 bg-white/70 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {/* Save status indicator */}
                        {rowState === "saving" ? (
                          <span className="text-slate-400 text-sm">⏳</span>
                        ) : rowState === "error" ? (
                          <span title="Save failed" className="text-red-500 text-sm">✗</span>
                        ) : dirty ? (
                          <span
                            title="Unsaved changes"
                            className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400"
                          />
                        ) : (
                          <span
                            title="Saved"
                            className="text-emerald-500 text-base leading-none"
                          >
                            ✓
                          </span>
                        )}
                        <div>
                          <h3 className="text-base font-semibold text-slate-900">
                            {attendee.rosterMember.firstName} {attendee.rosterMember.lastName}
                          </h3>
                          <p className="text-xs text-slate-500">
                            {attendee.rosterMember.memberRole} • Age{" "}
                            {attendee.rosterMember.ageAtStart ?? "N/A"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        <p>Current placement</p>
                        <p className="font-semibold text-slate-700">
                          {currentEnrollment?.classTitle ?? "Unassigned"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      {[0, 1, 2].map((index) => {
                        const selectedId = currentSelections[index] ?? "";
                        const selectedOffering = selectedId
                          ? timeslot.offerings.find((o) => o.id === selectedId)
                          : null;
                        const selectedEligibility = selectedOffering
                          ? evaluateClassRequirements(
                              {
                                ageAtStart: attendee.rosterMember.ageAtStart,
                                memberRole: attendee.rosterMember.memberRole,
                                masterGuide: attendee.rosterMember.masterGuide,
                                completedHonorCodes: attendee.rosterMember.completedHonorCodes,
                              },
                              selectedOffering.classCatalog.requirements as RequirementInput[],
                            )
                          : null;
                        const isSelectedIneligible =
                          selectedEligibility !== null && !selectedEligibility.eligible;

                        return (
                          <label
                            key={`${attendee.id}-${timeslot.id}-${index}`}
                            className="space-y-1 text-sm text-slate-700"
                          >
                            <span>Preference #{index + 1}</span>
                            <select
                              value={selectedId}
                              onChange={(e) =>
                                handleSelectionChange(attendee.id, timeslot.id, index, e.target.value)
                              }
                              className={`w-full rounded-lg border px-3 py-2 ${
                                isSelectedIneligible
                                  ? "border-amber-400 bg-amber-50"
                                  : "border-slate-300"
                              }`}
                            >
                              <option value="">No selection</option>
                              {timeslot.offerings.map((offering) => {
                                const eligibility = evaluateClassRequirements(
                                  {
                                    ageAtStart: attendee.rosterMember.ageAtStart,
                                    memberRole: attendee.rosterMember.memberRole,
                                    masterGuide: attendee.rosterMember.masterGuide,
                                    completedHonorCodes: attendee.rosterMember.completedHonorCodes,
                                  },
                                  offering.classCatalog.requirements as RequirementInput[],
                                );

                                return (
                                  <option
                                    key={offering.id}
                                    value={offering.id}
                                    disabled={!eligibility.eligible}
                                  >
                                    {eligibility.eligible
                                      ? offering.classCatalog.title
                                      : `[INELIGIBLE: ${eligibility.blockers.join(", ")}] ${offering.classCatalog.title}`}
                                  </option>
                                );
                              })}
                            </select>
                            {isSelectedIneligible && (
                              <p className="text-xs font-medium text-amber-700">
                                Warning: saved preference does not meet requirements (
                                {selectedEligibility.blockers.join(", ")}).
                              </p>
                            )}
                          </label>
                        );
                      })}
                    </div>

                    {/* Eligibility warnings */}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {timeslot.offerings.map((offering) => {
                        const eligibility = evaluateClassRequirements(
                          {
                            ageAtStart: attendee.rosterMember.ageAtStart,
                            memberRole: attendee.rosterMember.memberRole,
                            masterGuide: attendee.rosterMember.masterGuide,
                            completedHonorCodes: attendee.rosterMember.completedHonorCodes,
                          },
                          offering.classCatalog.requirements as RequirementInput[],
                        );

                        if (eligibility.eligible) return null;

                        return (
                          <span
                            key={`${attendee.id}-${offering.id}`}
                            className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800"
                          >
                            {offering.classCatalog.code}: {eligibility.blockers.join(", ")}
                          </span>
                        );
                      })}
                    </div>

                    {/* Per-row save button (fallback) */}
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() => handleSaveRow(attendee.id, timeslot.id)}
                        disabled={rowState === "saving"}
                        className="btn-primary"
                      >
                        {rowState === "saving" ? "Saving…" : "Save Preferences"}
                      </button>
                      {rowState === "error" && (
                        <p className="mt-1 text-xs text-red-600">Save failed. Please try again.</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        ))
      )}

      {/* Bottom save all button */}
      {classTimeslots.length > 0 && (
        <div className="glass-panel flex flex-wrap items-center gap-3">
          {saveAllButton}
          {saveAllSuccess && !hasDirtyRows && (
            <span className="text-sm text-emerald-600 font-medium">All preferences saved.</span>
          )}
          {saveAllError && <span className="text-sm text-red-600">{saveAllError}</span>}
        </div>
      )}
    </section>
  );
}
