"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormState } from "react-dom";
import { EventMode, FormFieldScope, type Prisma } from "@prisma/client";
import { useTranslations } from "next-intl";

import {
  type RegistrationActionState,
  saveEventRegistrationDraft,
  submitEventRegistration,
} from "../../../../actions/event-registration-actions";
import {
  bootstrapRegistrationResponses,
  getVisibleRegistrationFields,
  serializeRegistrationResponses,
} from "../../../../../lib/event-form-responses";
import { isEventFieldVisible, readEventFieldConfig } from "../../../../../lib/event-form-config";

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
  eventName: string;
  eventMode: EventMode;
  managedClubId: string | null;
  attendees: Attendee[];
  dynamicFields: DynamicField[];
  initialSelectedAttendeeIds: string[];
  initialResponses: ExistingResponse[];
  registrationStatus: string | null;
  canEditRegistration: boolean;
  registrationNotice: string | null;
  pricePerAttendee: number;
  classesHref: string | null;
  classAssignmentCoveredAttendeeIds: string[];
};

type RegistrationSection = {
  id: string;
  title: string;
  description: string;
  fields: DynamicField[];
  kind: "roster" | "club" | "group" | "review";
};

type ValidationIssue = {
  scope: "roster" | "club" | "group" | "review";
  sectionId: string;
  label: string;
  detail: string;
};

function attendeeName(attendee: Attendee) {
  return `${attendee.firstName} ${attendee.lastName}`;
}

function parseStringOptions(options: unknown) {
  return readEventFieldConfig(options).optionValues;
}

function parseDateInputValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function hasResponseValue(value: unknown) {
  if (value === null || typeof value === "undefined") {
    return false;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return true;
}

const INITIAL_ACTION_STATE: RegistrationActionState = {
  status: "idle",
  message: null,
};

export function RegistrationFormFulfiller({
  eventId,
  eventName,
  eventMode,
  managedClubId,
  attendees,
  dynamicFields,
  initialSelectedAttendeeIds,
  initialResponses,
  registrationStatus,
  canEditRegistration,
  registrationNotice,
  pricePerAttendee,
  classesHref,
  classAssignmentCoveredAttendeeIds,
}: RegistrationFormFulfillerProps) {
  const t = useTranslations("Director");
  const [selectedAttendeeIds, setSelectedAttendeeIds] = useState<string[]>(initialSelectedAttendeeIds);
  const [responseState, setResponseState] = useState(() => bootstrapRegistrationResponses(initialResponses));
  const [draftState, draftAction] = useFormState(saveEventRegistrationDraft, INITIAL_ACTION_STATE);
  const [submitState, submitAction] = useFormState(submitEventRegistration, INITIAL_ACTION_STATE);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [currentSectionId, setCurrentSectionId] = useState<string>("roster");

  useEffect(() => {
    if (submitState.status === "success" && submitState.checkoutUrl) {
      window.location.href = submitState.checkoutUrl;
    }
  }, [submitState.status, submitState.checkoutUrl]);

  const selectedAttendeeSet = useMemo(() => new Set(selectedAttendeeIds), [selectedAttendeeIds]);
  const classAssignmentCoverageSet = useMemo(() => new Set(classAssignmentCoveredAttendeeIds), [classAssignmentCoveredAttendeeIds]);
  const attendeeById = useMemo(
    () => Object.fromEntries(attendees.map((attendee) => [attendee.id, attendee])),
    [attendees],
  );

  const visibleFields = useMemo(
    () =>
      getVisibleRegistrationFields({
        fields: dynamicFields.filter(
          (field) =>
            field.type !== "FIELD_GROUP" &&
            (eventMode !== EventMode.BASIC_FORM || field.fieldScope !== FormFieldScope.ATTENDEE),
        ),
        globalResponses: responseState.globalResponses,
      }) as DynamicField[],
    [dynamicFields, eventMode, responseState.globalResponses],
  );

  const responsesByFieldKey = useMemo(
    () =>
      Object.fromEntries(
        dynamicFields
          .filter((field) => field.fieldScope === FormFieldScope.GLOBAL && field.type !== "FIELD_GROUP")
          .map((field) => [field.key, responseState.globalResponses[field.id]]),
      ),
    [dynamicFields, responseState.globalResponses],
  );

  const sections = useMemo<RegistrationSection[]>(() => {
    const nextSections: RegistrationSection[] = eventMode === EventMode.BASIC_FORM
      ? []
      : [
          {
            id: "roster",
            title: t("registrationForm.rosterTitle"),
            description: t("registrationForm.rosterSectionDescription"),
            fields: [],
            kind: "roster",
          },
        ];

    const standaloneFields = visibleFields.filter((field) => field.parentFieldId === null);

    if (standaloneFields.length > 0) {
      nextSections.push({
        id: "club-questions",
        title: t("registrationForm.clubTitle"),
        description: t("registrationForm.clubDescription"),
        fields: standaloneFields,
        kind: "club",
      });
    }

    const groups = dynamicFields.filter((field) => field.type === "FIELD_GROUP");

    for (const group of groups) {
      if (!isEventFieldVisible(group, responsesByFieldKey)) {
        continue;
      }

      const childFields = visibleFields.filter((field) => field.parentFieldId === group.id);

      if (childFields.length === 0) {
        continue;
      }

      nextSections.push({
        id: group.id,
        title: group.label,
        description: group.description ?? t("registrationForm.groupDefaultDescription"),
        fields: childFields,
        kind: "group",
      });
    }

    nextSections.push({
      id: "review",
      title: t("registrationForm.reviewTitle"),
      description: t("registrationForm.reviewDescription"),
      fields: [],
      kind: "review",
    });

    return nextSections;
  }, [dynamicFields, eventMode, responsesByFieldKey, t, visibleFields]);

  useEffect(() => {
    if (!sections.some((section) => section.id === currentSectionId)) {
      setCurrentSectionId(sections[0]?.id ?? "review");
    }
  }, [currentSectionId, sections]);

  const currentSectionIndex = Math.max(sections.findIndex((section) => section.id === currentSectionId), 0);
  const currentSection = sections[currentSectionIndex] ?? sections[0];
  const progressPercent = sections.length > 1 ? Math.round(((currentSectionIndex + 1) / sections.length) * 100) : 100;
  const selectedAttendees = selectedAttendeeIds.map((attendeeId) => attendeeById[attendeeId]).filter(Boolean);
  const estimatedTotal = selectedAttendeeIds.length * pricePerAttendee;

  const classAssignmentIssues = useMemo(() => {
    if (eventMode !== EventMode.CLASS_ASSIGNMENT) {
      return [];
    }

    return selectedAttendees.filter((attendee) => !classAssignmentCoverageSet.has(attendee.id));
  }, [classAssignmentCoverageSet, eventMode, selectedAttendees]);

  const payload = useMemo(() => {
    return JSON.stringify(
      serializeRegistrationResponses({
        fields: visibleFields,
        selectedAttendeeIds,
        globalResponses: responseState.globalResponses,
        attendeeResponses: responseState.attendeeResponses,
      }),
    );
  }, [responseState.attendeeResponses, responseState.globalResponses, selectedAttendeeIds, visibleFields]);

  const issuesBySectionId = useMemo(() => {
    return validationIssues.reduce<Record<string, number>>((accumulator, issue) => {
      accumulator[issue.sectionId] = (accumulator[issue.sectionId] ?? 0) + 1;
      return accumulator;
    }, {});
  }, [validationIssues]);

  function toggleAttendee(attendeeId: string, checked: boolean) {
    if (eventMode === EventMode.BASIC_FORM) {
      return;
    }

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

  function buildValidationIssues() {
    const issues: ValidationIssue[] = [];

    if (eventMode !== EventMode.BASIC_FORM && selectedAttendeeIds.length === 0) {
      issues.push({
        scope: "roster",
        sectionId: "roster",
        label: t("registrationForm.rosterTitle"),
        detail: t("registrationForm.missingAttendeeSelection"),
      });
    }

    for (const field of visibleFields) {
      if (!field.isRequired) {
        continue;
      }

      if (field.fieldScope === FormFieldScope.ATTENDEE) {
        for (const attendeeId of selectedAttendeeIds) {
          const value = responseState.attendeeResponses[attendeeId]?.[field.id];
          if (!hasResponseValue(value)) {
            const attendee = attendeeById[attendeeId];
            issues.push({
              scope: "group",
              sectionId: field.parentFieldId ?? "club-questions",
              label: field.label,
              detail: t("registrationForm.missingAttendeeField", {
                field: field.label,
                attendee: attendee ? attendeeName(attendee) : attendeeId,
              }),
            });
          }
        }
        continue;
      }

      if (!hasResponseValue(responseState.globalResponses[field.id])) {
        issues.push({
          scope: field.parentFieldId ? "group" : "club",
          sectionId: field.parentFieldId ?? "club-questions",
          label: field.label,
          detail: t("registrationForm.missingField", { field: field.label }),
        });
      }
    }

    if (eventMode === EventMode.CLASS_ASSIGNMENT && classAssignmentIssues.length > 0) {
      issues.push({
        scope: "review",
        sectionId: "review",
        label: t("registrationForm.classAssignmentIssuesTitle"),
        detail: t("registrationForm.classAssignmentIssuesSummary", { count: classAssignmentIssues.length }),
      });
    }

    return issues;
  }

  function openReviewStep() {
    const nextIssues = buildValidationIssues();
    setValidationIssues(nextIssues);
    setCurrentSectionId("review");
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
          <p className="text-xs text-slate-500">{t("registrationForm.chooseRosterMember")}</p>
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
          <option value="">{t("registrationForm.selectRosterMember")}</option>
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
          {t("registrationForm.yes")}
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
          <option value="">{t("registrationForm.selectOption")}</option>
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
            <p className="glass-card-soft text-xs text-slate-500">{t("registrationForm.selectAttendeeFirst")}</p>
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

  function renderReviewPanel() {
    return (
      <article className="glass-panel space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="section-title">{t("registrationForm.reviewTitle")}</h2>
            <p className="section-copy">{t("registrationForm.reviewDescription")}</p>
          </div>
          <span className="status-chip-neutral">{t("registrationForm.reviewBadge", { count: validationIssues.length })}</span>
        </div>

        {validationIssues.length > 0 ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <h3 className="text-sm font-semibold text-rose-900">{t("registrationForm.validationSummaryTitle")}</h3>
            <ul className="mt-3 space-y-2 text-sm text-rose-800">
              {validationIssues.map((issue, index) => (
                <li key={`${issue.sectionId}-${index}`} className="rounded-xl bg-white/70 px-3 py-2">
                  {issue.detail}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <p className="font-semibold">{t("registrationForm.reviewReadyTitle")}</p>
            <p className="mt-1">{t("registrationForm.reviewReadyDescription")}</p>
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                  {t("registrationForm.attendeeSummaryTitle")}
                </h3>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                  {t("common.selected", { count: selectedAttendeeIds.length })}
                </span>
              </div>
              {selectedAttendees.length === 0 ? (
                <p className="mt-3 text-sm text-slate-600">{t("registrationForm.attendeeSummaryEmpty")}</p>
              ) : (
                <ul className="mt-3 grid gap-2 md:grid-cols-2">
                  {selectedAttendees.map((attendee) => (
                    <li key={`summary-${attendee.id}`} className="rounded-xl bg-white px-3 py-3 text-sm text-slate-700">
                      <p className="font-semibold text-slate-900">{attendeeName(attendee)}</p>
                      <p className="mt-1 text-xs text-slate-500">{attendee.memberRole}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {eventMode === EventMode.CLASS_ASSIGNMENT ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-800">
                    {t("registrationForm.classAssignmentIssuesTitle")}
                  </h3>
                  {classesHref ? (
                    <a href={classesHref} className="text-xs font-semibold text-amber-900 underline underline-offset-2">
                      {t("registrationForm.openClassAssignments")}
                    </a>
                  ) : null}
                </div>
                {classAssignmentIssues.length === 0 ? (
                  <p className="mt-3 text-sm text-amber-900">{t("registrationForm.classAssignmentIssuesClear")}</p>
                ) : (
                  <>
                    <p className="mt-3 text-sm text-amber-900">{t("registrationForm.classAssignmentIssuesSummary", { count: classAssignmentIssues.length })}</p>
                    <ul className="mt-3 space-y-2 text-sm text-amber-900">
                      {classAssignmentIssues.map((attendee) => (
                        <li key={`class-issue-${attendee.id}`} className="rounded-xl bg-white/70 px-3 py-2">
                          {attendeeName(attendee)}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                {t("registrationForm.pricingSummaryTitle")}
              </h3>
              <dl className="mt-3 space-y-3 text-sm text-slate-700">
                <div className="flex items-center justify-between gap-3">
                  <dt>{t("registrationForm.pricingPerAttendee")}</dt>
                  <dd className="font-semibold text-slate-900">
                    {new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(pricePerAttendee)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt>{t("registrationForm.pricingAttendeeCount")}</dt>
                  <dd className="font-semibold text-slate-900">{selectedAttendeeIds.length}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
                  <dt className="font-semibold text-slate-900">{t("registrationForm.pricingEstimatedTotal")}</dt>
                  <dd className="text-lg font-semibold text-slate-900">
                    {new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(estimatedTotal)}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                {t("registrationForm.reviewChecklistTitle")}
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {sections
                  .filter((section) => section.kind !== "review")
                  .map((section) => (
                    <li key={`check-${section.id}`} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2">
                      <span>{section.title}</span>
                      <span className={`rounded-full px-2.5 py-1 text-[0.7rem] font-semibold ${issuesBySectionId[section.id] ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                        {issuesBySectionId[section.id] ? t("registrationForm.needsAttention") : t("registrationForm.ready")}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <form className="space-y-6">
      <input type="hidden" name="eventId" value={eventId} readOnly />
      {managedClubId ? <input type="hidden" name="clubId" value={managedClubId} readOnly /> : null}
      <input type="hidden" name="registrationPayload" value={payload} readOnly />

      {registrationNotice ? <p className="alert-warning">{registrationNotice}</p> : null}

      <fieldset disabled={!canEditRegistration} className="space-y-6 disabled:opacity-70">
        <article className="glass-panel space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="hero-kicker">{t("registrationForm.modules")}</p>
              <h2 className="section-title mt-2">{eventName}</h2>
              <p className="section-copy">{t("registrationForm.modulesDescription")}</p>
            </div>
            <div className="min-w-[12rem] space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span>{t("registrationForm.progressTitle")}</span>
                <span>{t("registrationForm.step", { current: currentSectionIndex + 1, total: sections.length })}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-200">
                <div className="h-2 rounded-full bg-indigo-600 transition-all" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            {sections.map((section, index) => {
              const isActive = section.id === currentSection?.id;
              const issueCount = issuesBySectionId[section.id] ?? 0;
              const isComplete = section.kind === "review"
                ? validationIssues.length === 0
                : issueCount === 0 && (section.kind !== "roster" || eventMode === EventMode.BASIC_FORM || selectedAttendeeIds.length > 0);

              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setCurrentSectionId(section.id)}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${
                    isActive
                      ? "border-indigo-300 bg-indigo-50"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {section.kind === "review" ? t("registrationForm.reviewStepLabel") : t("registrationForm.module", { index: index + 1 })}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{section.title}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[0.68rem] font-semibold ${issueCount > 0 ? "bg-rose-100 text-rose-700" : isComplete ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                      {issueCount > 0 ? t("registrationForm.issueCount", { count: issueCount }) : isComplete ? t("registrationForm.ready") : t("registrationForm.inProgress")}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {section.kind === "roster"
                      ? t("common.selected", { count: selectedAttendeeIds.length })
                      : section.kind === "review"
                        ? t("registrationForm.reviewCardDescription")
                        : t("registrationForm.activePrompts", { count: section.fields.length })}
                  </p>
                </button>
              );
            })}
          </div>
        </article>

        {currentSection?.kind === "roster" ? (
          <article className="glass-panel">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="section-title">{t("registrationForm.rosterTitle")}</h2>
                <p className="section-copy">{t("registrationForm.rosterDescription")}</p>
              </div>
              <span className="status-chip-neutral">{t("common.selected", { count: selectedAttendeeIds.length })}</span>
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {attendees.map((attendee) => (
                <label key={attendee.id} className="check-card">
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
        ) : currentSection?.kind === "review" ? (
          renderReviewPanel()
        ) : currentSection ? (
          <article className="glass-panel space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="section-title">{currentSection.title}</h2>
                <p className="section-copy">{currentSection.description}</p>
              </div>
              <span className="status-chip-neutral">
                {t("registrationForm.activePrompts", { count: currentSection.fields.length })}
              </span>
            </div>

            <div className="space-y-3">
              {currentSection.fields.map((field) => renderFieldCard(field))}
            </div>
          </article>
        ) : null}
      </fieldset>

      <div className="sticky-action-bar flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div className="space-y-1">
          {validationIssues.length > 0 ? <p className="text-xs font-medium text-rose-700">{t("registrationForm.validationSummaryShort", { count: validationIssues.length })}</p> : null}
          <p className="text-xs text-slate-500">
            {t("registrationForm.currentStatus", {
              status: registrationStatus ?? t("common.notStarted"),
            })}
          </p>
          {draftState.status === "error" && draftState.message ? <p className="text-xs font-medium text-rose-700">{draftState.message}</p> : null}
          {submitState.status === "error" && submitState.message ? <p className="text-xs font-medium text-rose-700">{submitState.message}</p> : null}
          {draftState.status === "success" && draftState.message ? <p className="text-xs font-medium text-emerald-700">{draftState.message}</p> : null}
          {submitState.status === "success" && submitState.message ? <p className="text-xs font-medium text-emerald-700">{submitState.message}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentSectionId(sections[Math.max(currentSectionIndex - 1, 0)]?.id ?? "review")}
            disabled={currentSectionIndex === 0}
            className="btn-secondary"
          >
            {t("registrationForm.previousSection")}
          </button>
          {currentSection?.id !== "review" ? (
            <button
              type="button"
              onClick={() => {
                const nextSection = sections[Math.min(currentSectionIndex + 1, sections.length - 1)];
                if (nextSection?.id === "review") {
                  openReviewStep();
                  return;
                }

                setCurrentSectionId(nextSection?.id ?? "review");
              }}
              className="btn-secondary"
            >
              {t("registrationForm.nextSection")}
            </button>
          ) : null}
          <button formAction={draftAction} type="submit" disabled={!canEditRegistration} className="btn-secondary">
            {t("registrationForm.saveDraft")}
          </button>
          {currentSection?.id !== "review" ? (
            <button type="button" onClick={openReviewStep} className="btn-primary">
              {t("registrationForm.continueToReview")}
            </button>
          ) : (
            <button
              formAction={submitAction}
              type="submit"
              disabled={!canEditRegistration}
              onClick={(event) => {
                const nextIssues = buildValidationIssues();
                setValidationIssues(nextIssues);

                if (nextIssues.length > 0) {
                  event.preventDefault();
                }
              }}
              className="btn-primary"
            >
              {t("registrationForm.submitRegistration")}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
