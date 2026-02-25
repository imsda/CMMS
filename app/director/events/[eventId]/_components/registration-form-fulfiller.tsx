"use client";

import { useMemo, useState } from "react";

import {
  saveEventRegistrationDraft,
  submitEventRegistration,
} from "../../../../actions/event-registration-actions";

type Attendee = {
  id: string;
  firstName: string;
  lastName: string;
  memberRole: string;
};

type DynamicField = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  type: string;
  isRequired: boolean;
  options: unknown;
};

type ExistingResponse = {
  fieldId: string;
  attendeeId: string | null;
  value: unknown;
};

type RegistrationFormFulfillerProps = {
  eventId: string;
  attendees: Attendee[];
  dynamicFields: DynamicField[];
  initialSelectedAttendeeIds: string[];
  initialResponses: ExistingResponse[];
  registrationStatus: string | null;
};

type GlobalResponseMap = Record<string, unknown>;
type AttendeeResponseMap = Record<string, string[]>;

function attendeeName(attendee: Attendee) {
  return `${attendee.firstName} ${attendee.lastName}`;
}

function parseStringOptions(options: unknown) {
  if (!Array.isArray(options)) {
    return [];
  }

  return options.filter((option): option is string => typeof option === "string");
}

function isAttendeeSpecificField(field: DynamicField) {
  if (field.key.startsWith("attendee_") || field.key.startsWith("member_")) {
    return true;
  }

  if (typeof field.description === "string" && field.description.toLowerCase().includes("[attendee]")) {
    return true;
  }

  if (field.options && typeof field.options === "object" && !Array.isArray(field.options)) {
    const metadata = field.options as Record<string, unknown>;
    return metadata.attendeeSpecific === true || metadata.scope === "ATTENDEE";
  }

  if (Array.isArray(field.options)) {
    return field.options.includes("__ATTENDEE_LIST__");
  }

  return false;
}

function bootstrapResponses(
  dynamicFields: DynamicField[],
  existingResponses: ExistingResponse[],
): { globalResponses: GlobalResponseMap; attendeeResponses: AttendeeResponseMap } {
  const attendeeSpecificIds = new Set(
    dynamicFields.filter((field) => isAttendeeSpecificField(field)).map((field) => field.id),
  );

  return existingResponses.reduce(
    (accumulator, response) => {
      if (attendeeSpecificIds.has(response.fieldId) && response.attendeeId) {
        const current = accumulator.attendeeResponses[response.fieldId] ?? [];
        accumulator.attendeeResponses[response.fieldId] = current.includes(response.attendeeId)
          ? current
          : [...current, response.attendeeId];
        return accumulator;
      }

      accumulator.globalResponses[response.fieldId] = response.value;
      return accumulator;
    },
    {
      globalResponses: {} as GlobalResponseMap,
      attendeeResponses: {} as AttendeeResponseMap,
    },
  );
}

export function RegistrationFormFulfiller({
  eventId,
  attendees,
  dynamicFields,
  initialSelectedAttendeeIds,
  initialResponses,
  registrationStatus,
}: RegistrationFormFulfillerProps) {
  const [selectedAttendeeIds, setSelectedAttendeeIds] = useState<string[]>(initialSelectedAttendeeIds);
  const bootstrapped = useMemo(
    () => bootstrapResponses(dynamicFields, initialResponses),
    [dynamicFields, initialResponses],
  );
  const [globalResponses, setGlobalResponses] = useState<GlobalResponseMap>(bootstrapped.globalResponses);
  const [attendeeResponses, setAttendeeResponses] = useState<AttendeeResponseMap>(bootstrapped.attendeeResponses);

  const selectedAttendeeSet = useMemo(() => new Set(selectedAttendeeIds), [selectedAttendeeIds]);
  const selectedAttendees = useMemo(
    () => attendees.filter((attendee) => selectedAttendeeSet.has(attendee.id)),
    [attendees, selectedAttendeeSet],
  );

  const payload = useMemo(() => {
    const responses: Array<{ fieldId: string; attendeeId: string | null; value: unknown }> = [];

    for (const field of dynamicFields) {
      if (isAttendeeSpecificField(field)) {
        const pickedAttendees = attendeeResponses[field.id] ?? [];
        for (const attendeeId of pickedAttendees) {
          if (selectedAttendeeSet.has(attendeeId)) {
            responses.push({
              fieldId: field.id,
              attendeeId,
              value: true,
            });
          }
        }
        continue;
      }

      const value = globalResponses[field.id];

      if (typeof value === "undefined" || value === null || value === "") {
        continue;
      }

      responses.push({
        fieldId: field.id,
        attendeeId: null,
        value,
      });
    }

    return JSON.stringify({
      attendeeIds: selectedAttendeeIds,
      responses,
    });
  }, [attendeeResponses, dynamicFields, globalResponses, selectedAttendeeIds, selectedAttendeeSet]);

  function toggleAttendee(attendeeId: string, checked: boolean) {
    setSelectedAttendeeIds((current) => {
      if (checked) {
        return current.includes(attendeeId) ? current : [...current, attendeeId];
      }

      return current.filter((id) => id !== attendeeId);
    });
  }

  function toggleAttendeeSpecificField(fieldId: string, attendeeId: string, checked: boolean) {
    setAttendeeResponses((current) => {
      const existing = current[fieldId] ?? [];
      const next = checked
        ? existing.includes(attendeeId)
          ? existing
          : [...existing, attendeeId]
        : existing.filter((id) => id !== attendeeId);

      return {
        ...current,
        [fieldId]: next,
      };
    });
  }

  return (
    <form className="space-y-6">
      <input type="hidden" name="eventId" value={eventId} readOnly />
      <input type="hidden" name="registrationPayload" value={payload} readOnly />

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Attendee Checklist</h2>
        <p className="mt-1 text-sm text-slate-600">
          Select every active roster member from your club who will attend this event.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {attendees.map((attendee) => (
            <label
              key={attendee.id}
              className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
            >
              <input
                type="checkbox"
                checked={selectedAttendeeSet.has(attendee.id)}
                onChange={(event) => toggleAttendee(attendee.id, event.currentTarget.checked)}
              />
              <span>
                {attendeeName(attendee)}
                <span className="ml-2 text-xs text-slate-500">({attendee.memberRole})</span>
              </span>
            </label>
          ))}
        </div>
      </article>

      {dynamicFields.length > 0 ? (
        <article className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Dynamic Event Questions</h2>
          <p className="text-sm text-slate-600">
            Complete all required registration questions before submitting.
          </p>

          {dynamicFields.map((field) => {
            const attendeeSpecific = isAttendeeSpecificField(field);

            return (
              <div key={field.id} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {field.label}
                    {field.isRequired ? <span className="ml-1 text-rose-600">*</span> : null}
                  </p>
                  {field.description ? (
                    <p className="text-xs text-slate-500">{field.description}</p>
                  ) : null}
                </div>

                {attendeeSpecific ? (
                  <div className="grid gap-2 md:grid-cols-2">
                    {selectedAttendees.length === 0 ? (
                      <p className="text-xs text-slate-500">Select attendees above to answer this question.</p>
                    ) : (
                      selectedAttendees.map((attendee) => {
                        const checked = (attendeeResponses[field.id] ?? []).includes(attendee.id);
                        return (
                          <label
                            key={`${field.id}-${attendee.id}`}
                            className="flex items-center gap-2 text-sm text-slate-700"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) =>
                                toggleAttendeeSpecificField(field.id, attendee.id, event.currentTarget.checked)
                              }
                            />
                            {attendeeName(attendee)}
                          </label>
                        );
                      })
                    )}
                  </div>
                ) : field.type === "BOOLEAN" ? (
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(globalResponses[field.id])}
                      onChange={(event) =>
                        setGlobalResponses((current) => ({
                          ...current,
                          [field.id]: event.currentTarget.checked,
                        }))
                      }
                    />
                    Yes
                  </label>
                ) : field.type === "MULTI_SELECT" ? (
                  <div className="space-y-1">
                    {parseStringOptions(field.options).map((option) => {
                      const value = Array.isArray(globalResponses[field.id])
                        ? (globalResponses[field.id] as string[])
                        : [];
                      const checked = value.includes(option);

                      return (
                        <label key={option} className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => {
                              setGlobalResponses((current) => {
                                const existing = Array.isArray(current[field.id])
                                  ? (current[field.id] as string[])
                                  : [];
                                const next = event.currentTarget.checked
                                  ? [...new Set([...existing, option])]
                                  : existing.filter((entry) => entry !== option);

                                return {
                                  ...current,
                                  [field.id]: next,
                                };
                              });
                            }}
                          />
                          {option}
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={typeof globalResponses[field.id] === "string" ? String(globalResponses[field.id]) : ""}
                    onChange={(event) =>
                      setGlobalResponses((current) => ({
                        ...current,
                        [field.id]: event.currentTarget.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                )}
              </div>
            );
          })}
        </article>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          Current status: <span className="font-semibold text-slate-700">{registrationStatus ?? "Not started"}</span>
        </p>
        <div className="flex items-center gap-2">
          <button
            formAction={saveEventRegistrationDraft}
            type="submit"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Save Draft
          </button>
          <button
            formAction={submitEventRegistration}
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Submit Registration
          </button>
        </div>
      </div>
    </form>
  );
}
