"use client";

import { useMemo, useState } from "react";
import { useFormState } from "react-dom";
import { FormFieldScope, type Prisma } from "@prisma/client";

import {
  type RegistrationActionState,
  saveEventRegistrationDraft,
  submitEventRegistration,
} from "../../../../actions/event-registration-actions";
import {
  bootstrapRegistrationResponses,
  serializeRegistrationResponses,
  validateRequiredRegistrationResponses,
} from "../../../../../lib/event-form-responses";

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
  fieldScope: FormFieldScope;
  isRequired: boolean;
  options: Prisma.JsonValue | null;
  parentFieldId: string | null;
};

type ExistingResponse = {
  fieldId: string;
  attendeeId: string | null;
  value: unknown;
};

type RegistrationFormFulfillerProps = {
  eventId: string;
  managedClubId: string | null;
  attendees: Attendee[];
  dynamicFields: DynamicField[];
  initialSelectedAttendeeIds: string[];
  initialResponses: ExistingResponse[];
  registrationStatus: string | null;
  canEditRegistration: boolean;
  registrationNotice: string | null;
};

function attendeeName(attendee: Attendee) {
  return `${attendee.firstName} ${attendee.lastName}`;
}

function parseStringOptions(options: unknown) {
  if (!Array.isArray(options)) {
    return [];
  }

  return options.filter((option): option is string => typeof option === "string");
}

function parseDateInputValue(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value;
}

const INITIAL_ACTION_STATE: RegistrationActionState = {
  status: "idle",
  message: null,
};

export function RegistrationFormFulfiller({
  eventId,
  managedClubId,
  attendees,
  dynamicFields,
  initialSelectedAttendeeIds,
  initialResponses,
  registrationStatus,
  canEditRegistration,
  registrationNotice,
}: RegistrationFormFulfillerProps) {
  const [selectedAttendeeIds, setSelectedAttendeeIds] = useState<string[]>(initialSelectedAttendeeIds);
  const [responseState, setResponseState] = useState(() => bootstrapRegistrationResponses(initialResponses));
  const [draftState, draftAction] = useFormState(saveEventRegistrationDraft, INITIAL_ACTION_STATE);
  const [submitState, submitAction] = useFormState(submitEventRegistration, INITIAL_ACTION_STATE);
  const [clientValidationMessage, setClientValidationMessage] = useState<string | null>(null);

  const selectedAttendeeSet = useMemo(() => new Set(selectedAttendeeIds), [selectedAttendeeIds]);
  const attendeeById = useMemo(
    () => Object.fromEntries(attendees.map((attendee) => [attendee.id, attendee])),
    [attendees],
  );

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
    return JSON.stringify(
      serializeRegistrationResponses({
        fields: dynamicFields.filter((field) => field.type !== "FIELD_GROUP"),
        selectedAttendeeIds,
        globalResponses: responseState.globalResponses,
        attendeeResponses: responseState.attendeeResponses,
      }),
    );
  }, [dynamicFields, responseState.attendeeResponses, responseState.globalResponses, selectedAttendeeIds]);

  function toggleAttendee(attendeeId: string, checked: boolean) {
    setSelectedAttendeeIds((current) => {
      if (checked) {
        return current.includes(attendeeId) ? current : [...current, attendeeId];
      }

      return current.filter((id) => id !== attendeeId);
    });
  }

  function updateGlobalResponse(fieldId: string, value: unknown) {
    setResponseState((current) => ({
      ...current,
      globalResponses: {
        ...current.globalResponses,
        [fieldId]: value,
      },
    }));
  }

  function updateAttendeeResponse(attendeeId: string, fieldId: string, value: unknown) {
    setResponseState((current) => ({
      ...current,
      attendeeResponses: {
        ...current.attendeeResponses,
        [attendeeId]: {
          ...(current.attendeeResponses[attendeeId] ?? {}),
          [fieldId]: value,
        },
      },
    }));
  }

  function validateBeforeSubmit() {
    return validateRequiredRegistrationResponses({
      fields: dynamicFields.filter((field) => field.type !== "FIELD_GROUP"),
      selectedAttendeeIds,
      globalResponses: responseState.globalResponses,
      attendeeResponses: responseState.attendeeResponses,
    });
  }

  function renderRosterSelect(
    field: DynamicField,
    currentValue: unknown,
    onValueChange: (value: unknown) => void,
    multi: boolean,
  ) {
    if (multi) {
      const selected = Array.isArray(currentValue) ? (currentValue as string[]) : [];

      return (
        <div className="glass-subsection space-y-2">
          <p className="text-xs text-slate-500">Choose one or more roster members.</p>
          <div className="grid gap-2 md:grid-cols-2">
            {attendees.map((attendee) => {
              const checked = selected.includes(attendee.id);

              return (
                <label key={`${field.id}-${attendee.id}`} className="check-card">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      const next = event.currentTarget.checked
                        ? [...new Set([...selected, attendee.id])]
                        : selected.filter((entry) => entry !== attendee.id);

                      onValueChange(next);
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
        <select
          value={selectedId}
          onChange={(event) => onValueChange(event.currentTarget.value)}
          className="select-glass"
        >
          <option value="">Select a roster member</option>
          {attendees.map((attendee) => (
            <option key={`${field.id}-opt-${attendee.id}`} value={attendee.id}>
              {attendeeName(attendee)} ({attendee.memberRole})
            </option>
          ))}
        </select>
      </div>
    );
  }

  function renderFieldInput(
    field: DynamicField,
    currentValue: unknown,
    onValueChange: (value: unknown) => void,
  ) {
    if (field.type === "BOOLEAN") {
      return (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={Boolean(currentValue)}
            onChange={(event) => onValueChange(event.currentTarget.checked)}
          />
          Yes
        </label>
      );
    }

    if (field.type === "MULTI_SELECT") {
      return (
        <div className="space-y-1">
          {parseStringOptions(field.options).map((option) => {
            const value = Array.isArray(currentValue) ? (currentValue as string[]) : [];
            const checked = value.includes(option);

            return (
              <label key={option} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    const next = event.currentTarget.checked
                      ? [...new Set([...value, option])]
                      : value.filter((entry) => entry !== option);

                    onValueChange(next);
                  }}
                />
                {option}
              </label>
            );
          })}
        </div>
      );
    }

    if (field.type === "SINGLE_SELECT") {
      const options = parseStringOptions(field.options);
      const value = typeof currentValue === "string" ? String(currentValue) : "";

      return (
        <select
          value={value}
          onChange={(event) => onValueChange(event.currentTarget.value)}
          className="select-glass"
        >
          <option value="">Select an option</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === "ROSTER_SELECT") {
      return renderRosterSelect(field, currentValue, onValueChange, false);
    }

    if (field.type === "ROSTER_MULTI_SELECT") {
      return renderRosterSelect(field, currentValue, onValueChange, true);
    }

    if (field.type === "NUMBER") {
      return (
        <input
          type="number"
          value={typeof currentValue === "number" ? Number(currentValue) : ""}
          onChange={(event) => onValueChange(event.currentTarget.value === "" ? "" : Number(event.currentTarget.value))}
          className="input-glass"
        />
      );
    }

    if (field.type === "DATE") {
      return (
        <input
          type="date"
          value={parseDateInputValue(currentValue)}
          onChange={(event) => onValueChange(event.currentTarget.value)}
          className="input-glass"
        />
      );
    }

    if (field.type === "LONG_TEXT") {
      return (
        <textarea
          value={typeof currentValue === "string" ? String(currentValue) : ""}
          onChange={(event) => onValueChange(event.currentTarget.value)}
          rows={4}
          className="textarea-glass"
        />
      );
    }

    return (
      <input
        type="text"
        value={typeof currentValue === "string" ? String(currentValue) : ""}
        onChange={(event) => onValueChange(event.currentTarget.value)}
        className="input-glass"
      />
    );
  }

  function renderFieldCard(field: DynamicField) {
    const isAttendeeScoped = field.fieldScope === FormFieldScope.ATTENDEE;

    return (
      <div key={field.id} className="glass-subsection space-y-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {field.label}
            {field.isRequired ? <span className="ml-1 text-rose-600">*</span> : null}
          </p>
          {field.description ? <p className="text-xs text-slate-500">{field.description}</p> : null}
        </div>
        {isAttendeeScoped ? (
          selectedAttendeeIds.length === 0 ? (
            <p className="glass-card-soft text-xs text-slate-500">
              Select at least one attendee to answer this question.
            </p>
          ) : (
            <div className="space-y-3">
              {selectedAttendeeIds.map((attendeeId) => {
                const attendee = attendeeById[attendeeId];
                const currentValue = responseState.attendeeResponses[attendeeId]?.[field.id];

                return (
                  <div key={`${field.id}-${attendeeId}`} className="glass-card-soft space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {attendee ? attendeeName(attendee) : attendeeId}
                    </p>
                    {renderFieldInput(field, currentValue, (value) => updateAttendeeResponse(attendeeId, field.id, value))}
                  </div>
                );
              })}
            </div>
          )
        ) : (
          renderFieldInput(field, responseState.globalResponses[field.id], (value) => updateGlobalResponse(field.id, value))
        )}
      </div>
    );
  }

  return (
    <form className="space-y-6">
      <input type="hidden" name="eventId" value={eventId} readOnly />
      {managedClubId ? <input type="hidden" name="clubId" value={managedClubId} readOnly /> : null}
      <input type="hidden" name="registrationPayload" value={payload} readOnly />

      {registrationNotice ? (
        <p className="alert-warning">
          {registrationNotice}
        </p>
      ) : null}

      <fieldset disabled={!canEditRegistration} className="space-y-6 disabled:opacity-70">
        <article className="glass-panel">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="section-title">Attendee Checklist</h2>
              <p className="section-copy">Select all roster members from your club who will attend this event.</p>
            </div>
            <span className="status-chip-neutral">
              {selectedAttendeeIds.length} selected
            </span>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {attendees.map((attendee) => (
              <label
                key={attendee.id}
                className="check-card"
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
          <article className="glass-panel space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="section-title">Dynamic Event Questions</h2>
                <p className="section-copy">Complete all required registration questions before submitting.</p>
              </div>
              <span className="status-chip-neutral">
                {dynamicFields.filter((field) => field.type !== "FIELD_GROUP").length} active prompts
              </span>
            </div>

            {groupedFields.standaloneFields.map((field) => renderFieldCard(field))}

            {groupedFields.groups.map((group) => (
              <section key={group.id} className="glass-subsection">
                <div className="mb-3">
                  <h3 className="text-base font-semibold text-indigo-900">{group.label}</h3>
                  {group.description ? <p className="text-xs text-indigo-700">{group.description}</p> : null}
                </div>
                <div className="space-y-3">
                  {group.children.length > 0 ? (
                    group.children.map((child) => renderFieldCard(child))
                  ) : (
                    <p className="glass-card-soft text-xs text-slate-500">
                      No child fields configured for this group.
                    </p>
                  )}
                </div>
              </section>
            ))}
          </article>
        ) : null}
      </fieldset>

      <div className="sticky-action-bar flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div className="space-y-1">
          {clientValidationMessage ? (
            <p className="text-xs font-medium text-rose-700">{clientValidationMessage}</p>
          ) : null}
          <p className="text-xs text-slate-500">
            Current status: <span className="font-semibold text-slate-700">{registrationStatus ?? "Not started"}</span>
          </p>
          {draftState.status === "error" && draftState.message ? (
            <p className="text-xs font-medium text-rose-700">{draftState.message}</p>
          ) : null}
          {submitState.status === "error" && submitState.message ? (
            <p className="text-xs font-medium text-rose-700">{submitState.message}</p>
          ) : null}
          {draftState.status === "success" && draftState.message ? (
            <p className="text-xs font-medium text-emerald-700">{draftState.message}</p>
          ) : null}
          {submitState.status === "success" && submitState.message ? (
            <p className="text-xs font-medium text-emerald-700">{submitState.message}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            formAction={draftAction}
            type="submit"
            disabled={!canEditRegistration}
            className="btn-secondary"
          >
            Save Draft
          </button>
          <button
            formAction={submitAction}
            type="submit"
            disabled={!canEditRegistration}
            onClick={(event) => {
              const validationMessage = validateBeforeSubmit();
              setClientValidationMessage(validationMessage);

              if (validationMessage) {
                event.preventDefault();
              }
            }}
            className="btn-primary"
          >
            Submit Registration
          </button>
        </div>
      </div>
    </form>
  );
}
