"use client";

import { useMemo, useState } from "react";
import { useFormState } from "react-dom";

import {
  type CamporeeRegistrationActionState,
  saveCamporeeRegistrationDraft,
  submitCamporeeRegistration,
} from "../../../../actions/camporee-registration-actions";
import { type CamporeeRegistrationPayload } from "../../../../../lib/camporee-registration";
import {
  CAMPOREE_CAMPSITE_TYPES,
  CAMPOREE_DUTY_PREFERENCES,
  CAMPOREE_MEAL_PLANS,
  CAMPOREE_PARTICIPATION_HIGHLIGHTS,
} from "../../../../../lib/camporee-workflow";

type Attendee = {
  id: string;
  firstName: string;
  lastName: string;
  memberRole: string;
};

type Props = {
  eventId: string;
  managedClubId: string | null;
  attendees: Attendee[];
  initialPayload: CamporeeRegistrationPayload;
  registrationStatus: string | null;
  canEditRegistration: boolean;
  registrationNotice: string | null;
  reviewerNotes: string | null;
  revisionRequestedReason: string | null;
};

const INITIAL_ACTION_STATE: CamporeeRegistrationActionState = {
  status: "idle",
  message: null,
};

const SECTION_ORDER = [
  "club-info",
  "attendance",
  "campsite",
  "travel",
  "meals",
  "participation",
  "safety",
  "ministry",
  "review",
] as const;

const SECTION_LABELS: Record<(typeof SECTION_ORDER)[number], string> = {
  "club-info": "1. Club Information",
  attendance: "2. Attendance & Roster",
  campsite: "3. Campsite Needs",
  travel: "4. Travel & Arrival",
  meals: "5. Meals & Food Planning",
  participation: "6. Participation Planning",
  safety: "7. Safety / Emergency",
  ministry: "8. Spiritual / Ministry Items",
  review: "9. Final Review",
};

function attendeeName(attendee: Attendee) {
  return `${attendee.firstName} ${attendee.lastName}`;
}

export function CamporeeRegistrationWorkflow({
  eventId,
  managedClubId,
  attendees,
  initialPayload,
  registrationStatus,
  canEditRegistration,
  registrationNotice,
  reviewerNotes,
  revisionRequestedReason,
}: Props) {
  const [payload, setPayload] = useState<CamporeeRegistrationPayload>(initialPayload);
  const [currentSection, setCurrentSection] = useState<(typeof SECTION_ORDER)[number]>("club-info");
  const [draftState, draftAction] = useFormState(saveCamporeeRegistrationDraft, INITIAL_ACTION_STATE);
  const [submitState, submitAction] = useFormState(submitCamporeeRegistration, INITIAL_ACTION_STATE);

  const selectedAttendeeSet = useMemo(() => new Set(payload.attendeeIds), [payload.attendeeIds]);
  const attendeeCount = payload.attendeeIds.length;

  function updateField<Key extends keyof CamporeeRegistrationPayload>(key: Key, value: CamporeeRegistrationPayload[Key]) {
    setPayload((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function toggleAttendee(attendeeId: string, checked: boolean) {
    setPayload((current) => ({
      ...current,
      attendeeIds: checked
        ? Array.from(new Set([...current.attendeeIds, attendeeId]))
        : current.attendeeIds.filter((id) => id !== attendeeId),
    }));
  }

  function toggleListValue(
    key: "dutyPreferences" | "participationHighlights",
    value: string,
    checked: boolean,
  ) {
    setPayload((current) => ({
      ...current,
      [key]: checked
        ? Array.from(new Set([...current[key], value]))
        : current[key].filter((entry) => entry !== value),
    }));
  }

  const payloadJson = JSON.stringify(payload);
  const currentIndex = SECTION_ORDER.indexOf(currentSection);

  return (
    <article className="glass-panel space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="hero-kicker">Camporee Registration</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Guided Camporee Club Registration</h2>
          <p className="mt-1 text-sm text-slate-600">
            Register your club as one group, select roster attendees, and complete the logistics planners the conference needs for campsite assignments and event operations.
          </p>
        </div>
        <div className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
          <p className="font-semibold">Current status</p>
          <p className="mt-1">{registrationStatus ?? "Not started"}</p>
        </div>
      </div>

      {registrationNotice ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {registrationNotice}
        </p>
      ) : null}

      {revisionRequestedReason ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <p className="font-semibold">Revision requested</p>
          <p className="mt-1">{revisionRequestedReason}</p>
        </div>
      ) : null}

      {reviewerNotes ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Conference review notes</p>
          <p className="mt-1">{reviewerNotes}</p>
        </div>
      ) : null}

      {draftState.message ? (
        <p className={`rounded-lg px-4 py-3 text-sm ${draftState.status === "success" ? "border border-emerald-200 bg-emerald-50 text-emerald-800" : "border border-rose-200 bg-rose-50 text-rose-700"}`}>
          {draftState.message}
        </p>
      ) : null}

      {submitState.message ? (
        <p className={`rounded-lg px-4 py-3 text-sm ${submitState.status === "success" ? "border border-emerald-200 bg-emerald-50 text-emerald-800" : "border border-rose-200 bg-rose-50 text-rose-700"}`}>
          {submitState.message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {SECTION_ORDER.map((sectionId) => (
          <button
            key={sectionId}
            type="button"
            onClick={() => setCurrentSection(sectionId)}
            className={`rounded-full px-3 py-2 text-xs font-semibold ${currentSection === sectionId ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"}`}
          >
            {SECTION_LABELS[sectionId]}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        {currentSection === "club-info" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm text-slate-700">
              <span>Primary contact name</span>
              <input value={payload.primaryContactName} onChange={(event) => updateField("primaryContactName", event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span>Primary contact phone</span>
              <input value={payload.primaryContactPhone} onChange={(event) => updateField("primaryContactPhone", event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span>Primary contact email</span>
              <input value={payload.primaryContactEmail} onChange={(event) => updateField("primaryContactEmail", event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span>Secondary contact name</span>
              <input value={payload.secondaryContactName} onChange={(event) => updateField("secondaryContactName", event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
              <span>Secondary contact phone</span>
              <input value={payload.secondaryContactPhone} onChange={(event) => updateField("secondaryContactPhone", event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
          </div>
        ) : null}

        {currentSection === "attendance" ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Select every roster-backed attendee your club plans to bring to Camporee.</p>
            <div className="grid gap-3 md:grid-cols-2">
              {attendees.map((attendee) => (
                <label key={attendee.id} className="flex items-start gap-3 rounded-xl border border-slate-200 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedAttendeeSet.has(attendee.id)}
                    onChange={(event) => toggleAttendee(attendee.id, event.target.checked)}
                  />
                  <span>
                    <span className="block font-semibold text-slate-900">{attendeeName(attendee)}</span>
                    <span className="block text-xs text-slate-500">{attendee.memberRole}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {currentSection === "campsite" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm text-slate-700">
              <span>Campsite type</span>
              <select value={payload.campsiteType} onChange={(event) => updateField("campsiteType", event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2">
                {CAMPOREE_CAMPSITE_TYPES.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span>Estimated square footage needed</span>
              <input type="number" min={0} value={payload.squareFootageNeeded} onChange={(event) => updateField("squareFootageNeeded", Number.parseInt(event.target.value || "0", 10) || 0)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
              <span>Tent sizes and quantities</span>
              <textarea value={payload.tentSummary} onChange={(event) => updateField("tentSummary", event.target.value)} rows={4} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span>Trailer count</span>
              <input type="number" min={0} value={payload.trailerCount} onChange={(event) => updateField("trailerCount", Number.parseInt(event.target.value || "0", 10) || 0)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span>Kitchen canopy count</span>
              <input type="number" min={0} value={payload.kitchenCanopyCount} onChange={(event) => updateField("kitchenCanopyCount", Number.parseInt(event.target.value || "0", 10) || 0)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span>Camp-near request</span>
              <input value={payload.campNearRequest} onChange={(event) => updateField("campNearRequest", event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
              <span>Campsite notes</span>
              <textarea value={payload.campsiteNotes} onChange={(event) => updateField("campsiteNotes", event.target.value)} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
          </div>
        ) : null}

        {currentSection === "travel" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm text-slate-700">
              <span>Arrival date and time</span>
              <input type="datetime-local" value={payload.arrivalDateTime} onChange={(event) => updateField("arrivalDateTime", event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span>Departure date and time</span>
              <input type="datetime-local" value={payload.departureDateTime} onChange={(event) => updateField("departureDateTime", event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span>Vehicle count</span>
              <input type="number" min={0} value={payload.vehicleCount} onChange={(event) => updateField("vehicleCount", Number.parseInt(event.target.value || "0", 10) || 0)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span>Transport summary</span>
              <input value={payload.transportSummary} onChange={(event) => updateField("transportSummary", event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
              <span>Arrival notes</span>
              <textarea value={payload.arrivalNotes} onChange={(event) => updateField("arrivalNotes", event.target.value)} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
          </div>
        ) : null}

        {currentSection === "meals" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm text-slate-700">
              <span>Meal plan</span>
              <select value={payload.mealPlan} onChange={(event) => updateField("mealPlan", event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2">
                {CAMPOREE_MEAL_PLANS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={payload.waterServiceNeeded} onChange={(event) => updateField("waterServiceNeeded", event.target.checked)} />
              Water service needed
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span>Sabbath supper count</span>
              <input type="number" min={0} value={payload.sabbathSupperCount} onChange={(event) => updateField("sabbathSupperCount", Number.parseInt(event.target.value || "0", 10) || 0)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span>Sunday breakfast count</span>
              <input type="number" min={0} value={payload.sundayBreakfastCount} onChange={(event) => updateField("sundayBreakfastCount", Number.parseInt(event.target.value || "0", 10) || 0)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
              <span>Food planning notes</span>
              <textarea value={payload.foodPlanningNotes} onChange={(event) => updateField("foodPlanningNotes", event.target.value)} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
              <span>Dietary notes</span>
              <textarea value={payload.dietaryNotes} onChange={(event) => updateField("dietaryNotes", event.target.value)} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
          </div>
        ) : null}

        {currentSection === "participation" ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm text-slate-700">
                <span>First aid certified adults</span>
                <input type="number" min={0} value={payload.firstAidCertifiedCount} onChange={(event) => updateField("firstAidCertifiedCount", Number.parseInt(event.target.value || "0", 10) || 0)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="space-y-1 text-sm text-slate-700">
                <span>Leadership / staff count</span>
                <input type="number" min={0} value={payload.leadershipStaffCount} onChange={(event) => updateField("leadershipStaffCount", Number.parseInt(event.target.value || "0", 10) || 0)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Duty preferences</p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {CAMPOREE_DUTY_PREFERENCES.map((option) => (
                  <label key={option} className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={payload.dutyPreferences.includes(option)} onChange={(event) => toggleListValue("dutyPreferences", option, event.target.checked)} />
                    {option}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Participation highlights</p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {CAMPOREE_PARTICIPATION_HIGHLIGHTS.map((option) => (
                  <label key={option} className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={payload.participationHighlights.includes(option)} onChange={(event) => toggleListValue("participationHighlights", option, event.target.checked)} />
                    {option}
                  </label>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {currentSection === "safety" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm text-slate-700">
              <span>Emergency contact name</span>
              <input value={payload.emergencyContactName} onChange={(event) => updateField("emergencyContactName", event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span>Emergency contact phone</span>
              <input value={payload.emergencyContactPhone} onChange={(event) => updateField("emergencyContactPhone", event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
              <span>Emergency meeting point</span>
              <input value={payload.emergencyMeetingPoint} onChange={(event) => updateField("emergencyMeetingPoint", event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
              <span>Medication storage notes</span>
              <textarea value={payload.medicationStorageNotes} onChange={(event) => updateField("medicationStorageNotes", event.target.value)} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
              <span>Emergency and safety notes</span>
              <textarea value={payload.emergencyNotes} onChange={(event) => updateField("emergencyNotes", event.target.value)} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
          </div>
        ) : null}

        {currentSection === "ministry" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
              <input type="checkbox" checked={payload.chaplainVisitRequested} onChange={(event) => updateField("chaplainVisitRequested", event.target.checked)} />
              Request chaplain / pastoral visit support
            </label>
            <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
              <span>Worship participation notes</span>
              <textarea value={payload.worshipParticipationNotes} onChange={(event) => updateField("worshipParticipationNotes", event.target.value)} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
              <span>Ministry display or outreach notes</span>
              <textarea value={payload.ministryDisplayNotes} onChange={(event) => updateField("ministryDisplayNotes", event.target.value)} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
          </div>
        ) : null}

        {currentSection === "review" ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Attendees</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{attendeeCount}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Campsite Type</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{payload.campsiteType}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Meal Plan</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{payload.mealPlan}</p>
              </div>
            </div>
            <label className="space-y-1 text-sm text-slate-700">
              <span>Final review notes for the conference team</span>
              <textarea value={payload.finalReviewNotes} onChange={(event) => updateField("finalReviewNotes", event.target.value)} rows={4} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          className="btn-secondary"
          disabled={currentIndex === 0}
          onClick={() => setCurrentSection(SECTION_ORDER[Math.max(0, currentIndex - 1)])}
        >
          Previous Section
        </button>
        <div className="flex flex-wrap gap-2">
          <form action={draftAction}>
            <input type="hidden" name="eventId" value={eventId} readOnly />
            {managedClubId ? <input type="hidden" name="clubId" value={managedClubId} readOnly /> : null}
            <input type="hidden" name="camporeePayload" value={payloadJson} readOnly />
            <button type="submit" disabled={!canEditRegistration} className="btn-secondary">Save Draft</button>
          </form>
          <form action={submitAction}>
            <input type="hidden" name="eventId" value={eventId} readOnly />
            {managedClubId ? <input type="hidden" name="clubId" value={managedClubId} readOnly /> : null}
            <input type="hidden" name="camporeePayload" value={payloadJson} readOnly />
            <button type="submit" disabled={!canEditRegistration} className="btn-primary">Submit Camporee Registration</button>
          </form>
          <button
            type="button"
            className="btn-secondary"
            disabled={currentIndex === SECTION_ORDER.length - 1}
            onClick={() => setCurrentSection(SECTION_ORDER[Math.min(SECTION_ORDER.length - 1, currentIndex + 1)])}
          >
            Next Section
          </button>
        </div>
      </div>
    </article>
  );
}
