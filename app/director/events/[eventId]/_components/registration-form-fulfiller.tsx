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
  parentFieldId: string | null;
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

function attendeeName(attendee: Attendee) {
  return `${attendee.firstName} ${attendee.lastName}`;
}

function parseStringOptions(options: unknown) {
  if (!Array.isArray(options)) {
    return [];
  }

  return options.filter((option): option is string => typeof option === "string");
}

function bootstrapResponses(existingResponses: ExistingResponse[]): GlobalResponseMap {
  return existingResponses.reduce((accumulator, response) => {
    accumulator[response.fieldId] = response.value;
    return accumulator;
  }, {} as GlobalResponseMap);
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
  const [globalResponses, setGlobalResponses] = useState<GlobalResponseMap>(() =>
    bootstrapResponses(initialResponses),
  );

  const selectedAttendeeSet = useMemo(() => new Set(selectedAttendeeIds), [selectedAttendeeIds]);

  const groupedFields = useMemo(() => {
    const groups = dynamicFields
      .filter((field) => field.type === "FIELD_GROUP")
      .map((group) => ({
        ...group,
        children: dynamicFields.filter((child) => child.parentFieldId === group.id),
      }));

    const standaloneFields = dynamicFields.filter(
      (field) => field.type !== "FIELD_GROUP" && field.parentFieldId === null,
    );

    return {
      groups,
      standaloneFields,
    };
  }, [dynamicFields]);

  const payload = useMemo(() => {
    const responses: Array<{ fieldId: string; attendeeId: string | null; value: unknown }> = [];

    for (const field of dynamicFields) {
      if (field.type === "FIELD_GROUP") {
        continue;
      }

      const value = globalResponses[field.id];
      const isEmptyArray = Array.isArray(value) && value.length === 0;

      if (typeof value === "undefined" || value === null || value === "" || isEmptyArray) {
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
  }, [dynamicFields, globalResponses, selectedAttendeeIds]);

  function toggleAttendee(attendeeId: string, checked: boolean) {
    setSelectedAttendeeIds((current) => {
      if (checked) {
        return current.includes(attendeeId) ? current : [...current, attendeeId];
      }

      return current.filter((id) => id !== attendeeId);
    });
  }

  function renderRosterSelect(field: DynamicField, multi: boolean) {
    const currentValue = globalResponses[field.id];

    if (multi) {
      const selected = Array.isArray(currentValue) ? (currentValue as string[]) : [];

      return (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-xs text-slate-500">Choose one or more roster members.</p>
          <div className="grid gap-2 md:grid-cols-2">
            {attendees.map((attendee) => {
              const checked = selected.includes(attendee.id);

              return (
                <label key={`${field.id}-${attendee.id}`} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      setGlobalResponses((current) => {
                        const existing = Array.isArray(current[field.id]) ? (current[field.id] as string[]) : [];
                        const next = event.currentTarget.checked
                          ? [...new Set([...existing, attendee.id])]
                          : existing.filter((entry) => entry !== attendee.id);

                        return {
                          ...current,
                          [field.id]: next,
                        };
                      });
                    }}
                  />
                  <span>
                    {attendeeName(attendee)}
                    <span className="ml-2 text-xs text-slate-500">({attendee.memberRole})</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      );
    }

    const selectedId = typeof currentValue === "string" ? currentValue : "";

    return (
      <div className="space-y-1">
        <input
          list={`roster-options-${field.id}`}
          value={selectedId}
          onChange={(event) =>
            setGlobalResponses((current) => ({
              ...current,
              [field.id]: event.currentTarget.value,
            }))
          }
          placeholder="Select roster member id"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        <datalist id={`roster-options-${field.id}`}>
          {attendees.map((attendee) => (
            <option key={`${field.id}-opt-${attendee.id}`} value={attendee.id}>
              {attendeeName(attendee)}
            </option>
          ))}
        </datalist>
        <p className="text-xs text-slate-500">Type to search by roster member id and pick from suggestions.</p>
      </div>
    );
  }

  function renderFieldInput(field: DynamicField) {
    if (field.type === "BOOLEAN") {
      return (
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
      );
    }

    if (field.type === "MULTI_SELECT") {
      return (
        <div className="space-y-1">
          {parseStringOptions(field.options).map((option) => {
            const value = Array.isArray(globalResponses[field.id]) ? (globalResponses[field.id] as string[]) : [];
            const checked = value.includes(option);

            return (
              <label key={option} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    setGlobalResponses((current) => {
                      const existing = Array.isArray(current[field.id]) ? (current[field.id] as string[]) : [];
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
      );
    }

    if (field.type === "ROSTER_SELECT") {
      return renderRosterSelect(field, false);
    }

    if (field.type === "ROSTER_MULTI_SELECT") {
      return renderRosterSelect(field, true);
    }

    if (field.type === "NUMBER") {
      return (
        <input
          type="number"
          value={typeof globalResponses[field.id] === "number" ? Number(globalResponses[field.id]) : ""}
          onChange={(event) =>
            setGlobalResponses((current) => ({
              ...current,
              [field.id]: event.currentTarget.value === "" ? "" : Number(event.currentTarget.value),
            }))
          }
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        />
      );
    }

    return (
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
    );
  }

  function renderFieldCard(field: DynamicField) {
    return (
      <div key={field.id} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {field.label}
            {field.isRequired ? <span className="ml-1 text-rose-600">*</span> : null}
          </p>
          {field.description ? <p className="text-xs text-slate-500">{field.description}</p> : null}
        </div>
        {renderFieldInput(field)}
      </div>
    );
  }

  return (
    <form className="space-y-6">
      <input type="hidden" name="eventId" value={eventId} readOnly />
      <input type="hidden" name="registrationPayload" value={payload} readOnly />

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Attendee Checklist</h2>
        <p className="mt-1 text-sm text-slate-600">Select all roster members from your club who will attend this event.</p>

        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {attendees.map((attendee) => (
            <label
              key={attendee.id}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
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
          <p className="text-sm text-slate-600">Complete all required registration questions before submitting.</p>

          {groupedFields.standaloneFields.map((field) => renderFieldCard(field))}

          {groupedFields.groups.map((group) => (
            <section key={group.id} className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
              <div className="mb-3">
                <h3 className="text-base font-semibold text-indigo-900">{group.label}</h3>
                {group.description ? <p className="text-xs text-indigo-700">{group.description}</p> : null}
              </div>
              <div className="space-y-3">
                {group.children.length > 0 ? (
                  group.children.map((child) => renderFieldCard(child))
                ) : (
                  <p className="rounded-lg border border-dashed border-indigo-300 bg-white p-3 text-xs text-slate-500">
                    No child fields configured for this group.
                  </p>
                )}
              </div>
            </section>
          ))}
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
