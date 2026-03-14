"use client";

import Link from "next/link";
import { EventMode, EventTemplateCategory, EventTemplateSource } from "@prisma/client";
import { useMemo, useState } from "react";
import { useFormState } from "react-dom";

import {
  saveEventTemplate,
} from "../../../../actions/event-admin-actions";
import {
  eventTemplateInitialState,
  type EventTemplateActionState,
} from "../../../../actions/event-admin-state";
import { type EventTemplateDraft } from "../../../../../lib/event-templates";
import { getAllEventModes } from "../../../../../lib/event-modes";
import {
  DynamicFormBuilder,
  type DynamicFieldDraft,
} from "../../new/_components/dynamic-form-builder";

const TEMPLATE_CATEGORY_OPTIONS: Array<{
  value: EventTemplateCategory;
  label: string;
}> = [
  { value: EventTemplateCategory.BASIC_EVENTS, label: "Basic Events" },
  { value: EventTemplateCategory.CLUB_REGISTRATION, label: "Club Registration" },
  { value: EventTemplateCategory.CLASS_ASSIGNMENT, label: "Class Assignment" },
  { value: EventTemplateCategory.MONTHLY_REPORTS, label: "Monthly Reports" },
];

function emptyTemplateFields(): DynamicFieldDraft[] {
  return [];
}

type EventTemplateEditorProps = {
  template: EventTemplateDraft | null;
};

export function EventTemplateEditor({ template }: EventTemplateEditorProps) {
  const isSystemTemplate = template?.source === EventTemplateSource.SYSTEM;
  const eventModes = getAllEventModes();
  const [eventMode, setEventMode] = useState<EventMode>(
    template?.eventMode ?? EventMode.CLUB_REGISTRATION,
  );
  const [fields, setFields] = useState<DynamicFieldDraft[]>(
    template?.snapshot.dynamicFields ?? emptyTemplateFields(),
  );
  const [state, formAction] = useFormState<EventTemplateActionState, FormData>(
    saveEventTemplate,
    eventTemplateInitialState,
  );
  const serializedFields = useMemo(() => JSON.stringify(fields), [fields]);

  return (
    <form action={formAction} className="space-y-6">
      {template ? <input type="hidden" name="templateId" value={template.id} readOnly /> : null}
      <input type="hidden" name="eventMode" value={eventMode} readOnly />
      <input type="hidden" name="dynamicFieldsJson" value={serializedFields} readOnly />

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              {template ? template.name : "New Template"}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Create reusable event setups with a fixed mode, prebuilt defaults, and dynamic questions.
            </p>
          </div>
          {template ? (
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                template.source === EventTemplateSource.SYSTEM
                  ? "bg-amber-100 text-amber-800"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              {template.source === EventTemplateSource.SYSTEM ? "Official System Template" : "User Template"}
            </span>
          ) : null}
        </div>

        {isSystemTemplate ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            System templates are view-only here. Duplicate the template from the library to customize it.
          </p>
        ) : null}

        <div className={`mt-6 grid gap-4 md:grid-cols-2 ${isSystemTemplate ? "pointer-events-none opacity-60" : ""}`}>
          <label className="space-y-1 text-sm text-slate-700">
            <span>Template Name</span>
            <input
              name="templateName"
              required
              defaultValue={template?.name ?? ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="space-y-1 text-sm text-slate-700">
            <span>Category</span>
            <select
              name="templateCategory"
              defaultValue={template?.category ?? EventTemplateCategory.BASIC_EVENTS}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              {TEMPLATE_CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
            <span>Description</span>
            <textarea
              name="templateDescription"
              rows={3}
              defaultValue={template?.description ?? ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 md:col-span-2">
            <input
              name="templateIsActive"
              type="checkbox"
              defaultChecked={template ? template.isActive : true}
            />
            Keep this template available in the library
          </label>
        </div>
      </div>

      <div className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${isSystemTemplate ? "pointer-events-none opacity-60" : ""}`}>
        <h2 className="text-xl font-semibold text-slate-900">Event Mode</h2>
        <p className="mt-1 text-sm text-slate-600">
          Templates lock in the event mode so new events start with the correct workflow.
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {eventModes.map((mode) => (
            <label
              key={mode.value}
              className={`rounded-2xl border p-4 transition ${
                eventMode === mode.value
                  ? "border-indigo-300 bg-indigo-50"
                  : "border-slate-200 bg-slate-50 hover:border-slate-300"
              }`}
            >
              <input
                type="radio"
                checked={eventMode === mode.value}
                onChange={() => setEventMode(mode.value)}
                className="sr-only"
              />
              <p className="text-sm font-semibold text-slate-900">{mode.label}</p>
              <p className="mt-1 text-sm text-slate-600">{mode.description}</p>
            </label>
          ))}
        </div>
      </div>

      <div className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${isSystemTemplate ? "pointer-events-none opacity-60" : ""}`}>
        <h2 className="text-xl font-semibold text-slate-900">Template Defaults</h2>
        <p className="mt-1 text-sm text-slate-600">
          These defaults carry into the create-event flow and remain editable when the event is created.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
            <span>Event Name Default</span>
            <input
              name="name"
              required
              defaultValue={template?.snapshot.name ?? ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
            <span>Event Description Default</span>
            <textarea
              name="description"
              rows={3}
              defaultValue={template?.snapshot.description ?? ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span>Starts At</span>
            <input name="startsAt" type="datetime-local" required defaultValue={template?.snapshot.startsAt ?? ""} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span>Ends At</span>
            <input name="endsAt" type="datetime-local" required defaultValue={template?.snapshot.endsAt ?? ""} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span>Registration Opens</span>
            <input name="registrationOpensAt" type="datetime-local" required defaultValue={template?.snapshot.registrationOpensAt ?? ""} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span>Registration Closes</span>
            <input name="registrationClosesAt" type="datetime-local" required defaultValue={template?.snapshot.registrationClosesAt ?? ""} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span>Base Price</span>
            <input name="basePrice" type="number" min="0" step="0.01" required defaultValue={template?.snapshot.basePrice ?? ""} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span>Late Fee Price</span>
            <input name="lateFeePrice" type="number" min="0" step="0.01" required defaultValue={template?.snapshot.lateFeePrice ?? ""} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
            <span>Late Fee Starts At</span>
            <input name="lateFeeStartsAt" type="datetime-local" required defaultValue={template?.snapshot.lateFeeStartsAt ?? ""} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span>Location Name</span>
            <input name="locationName" defaultValue={template?.snapshot.locationName ?? ""} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span>Location Address</span>
            <input name="locationAddress" defaultValue={template?.snapshot.locationAddress ?? ""} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
        </div>
      </div>

      <div className={isSystemTemplate ? "pointer-events-none opacity-60" : ""}>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-slate-900">Template Form Builder</h2>
            <p className="mt-1 text-sm text-slate-600">
              Shape the reusable registration form that new events will start with.
            </p>
          </div>
          <DynamicFormBuilder fields={fields} onChange={setFields} />
        </div>
      </div>

      {state.status === "error" && state.message ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.message}
        </p>
      ) : null}

      {state.status === "success" && state.message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/events/templates" className="btn-secondary">
          Back to Template Library
        </Link>
        {!isSystemTemplate ? (
          <button type="submit" className="btn-primary">
            {template ? "Save Template Changes" : "Create Template"}
          </button>
        ) : null}
      </div>
    </form>
  );
}
