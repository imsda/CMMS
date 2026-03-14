"use client";

import Link from "next/link";
import { EventMode } from "@prisma/client";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useFormState } from "react-dom";

import {
  createEventWithDynamicFields,
  saveEventTemplate,
} from "../../../../actions/event-admin-actions";
import {
  type CreateEventActionState,
  eventTemplateInitialState,
  type EventTemplateActionState,
} from "../../../../actions/event-admin-state";
import { type EventTemplateDraft } from "../../../../../lib/event-templates";
import { AdminPageHeader } from "../../../_components/admin-page-header";
import {
  DynamicFormBuilder,
  type DynamicFieldDraft,
} from "./dynamic-form-builder";
import { getAllEventModes, getEventModeConfig } from "../../../../../lib/event-modes";
import {
  getTemplateCategoryLabel,
  getTemplateCoverageSummary,
  getTemplateSectionSummaries,
  getTemplateSourceLabel,
} from "../../../../../lib/template-library";

const STEPS = [
  {
    titleKey: "pages.createEvent.steps.eventBasics.title",
    descriptionKey: "pages.createEvent.steps.eventBasics.description",
  },
  {
    titleKey: "pages.createEvent.steps.registration.title",
    descriptionKey: "pages.createEvent.steps.registration.description",
  },
  {
    titleKey: "pages.createEvent.steps.questions.title",
    descriptionKey: "pages.createEvent.steps.questions.description",
  },
] as const;

const INITIAL_EVENT_STATE: CreateEventActionState = {
  status: "idle",
  message: null,
};

type AdminCreateEventClientProps = {
  created: boolean;
  selectedTemplateId: string | null;
  templates: EventTemplateDraft[];
};

type CreationSource = "template" | "blank";

export function AdminCreateEventClient({
  created,
  selectedTemplateId,
  templates,
}: AdminCreateEventClientProps) {
  const t = useTranslations("Admin");
  const eventModes = getAllEventModes();
  const [currentStep, setCurrentStep] = useState(0);
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? null;
  const [creationSource, setCreationSource] = useState<CreationSource>(
    "template",
  );
  const [blankEventMode, setBlankEventMode] = useState<EventMode>(EventMode.CLUB_REGISTRATION);
  const [dynamicFields, setDynamicFields] = useState<DynamicFieldDraft[]>(
    selectedTemplate?.snapshot.dynamicFields ?? [],
  );
  const [clientValidationMessage, setClientValidationMessage] = useState<string | null>(null);
  const [formState, formAction] = useFormState(createEventWithDynamicFields, INITIAL_EVENT_STATE);
  const [templateState, templateFormAction] = useFormState<EventTemplateActionState, FormData>(
    saveEventTemplate,
    eventTemplateInitialState,
  );

  const serializedFields = useMemo(() => JSON.stringify(dynamicFields), [dynamicFields]);
  const selectedEventMode = creationSource === "template"
    ? selectedTemplate?.snapshot.eventMode ?? null
    : blankEventMode;
  const selectedModeConfig = selectedEventMode ? getEventModeConfig(selectedEventMode) : null;

  function validateBeforeSubmit() {
    if (creationSource === "template" && !selectedTemplate) {
      return t("pages.createEvent.validation.missingTemplate");
    }

    if (creationSource === "blank" && !selectedEventMode) {
      return t("pages.createEvent.validation.missingEventMode");
    }

    for (const [index, field] of dynamicFields.entries()) {
      if (field.label.trim().length === 0) {
        return t("pages.createEvent.validation.missingLabel", { index: index + 1 });
      }

      if ((field.type === "MULTI_SELECT" || field.type === "SINGLE_SELECT") && field.options.length === 0) {
        return t("pages.createEvent.validation.missingOptions", { label: field.label || `#${index + 1}` });
      }

      if (field.conditionalFieldKey.trim().length > 0 && field.conditionalOperator.length === 0) {
        return t("pages.createEvent.validation.missingConditionalOperator", {
          label: field.label || `#${index + 1}`,
        });
      }

      if (field.conditionalOperator.length > 0 && field.conditionalFieldKey.trim().length === 0) {
        return t("pages.createEvent.validation.missingConditionalSource", {
          label: field.label || `#${index + 1}`,
        });
      }

      if (
        field.conditionalOperator.length > 0 &&
        field.conditionalOperator !== "truthy" &&
        field.conditionalOperator !== "falsy" &&
        field.conditionalValue.trim().length === 0
      ) {
        return t("pages.createEvent.validation.missingConditionalValue", {
          label: field.label || `#${index + 1}`,
        });
      }
    }

    return null;
  }

  return (
    <section className="space-y-6">
      <AdminPageHeader
        eyebrow={t("pages.createEvent.eyebrow")}
        breadcrumbs={[
          { label: t("breadcrumbs.admin"), href: "/admin/dashboard" },
          { label: t("breadcrumbs.events"), href: "/admin/events" },
          { label: t("breadcrumbs.createEvent") },
        ]}
        title={t("pages.createEvent.title")}
        description={t("pages.createEvent.description")}
        secondaryActions={
          <>
            <Link href="/admin/events/templates" className="btn-secondary">
              Template Library
            </Link>
            <Link href="/admin/events" className="btn-secondary">
              {t("actions.backToEvents")}
            </Link>
            {selectedTemplate ? (
              <Link href="/admin/events/new" className="btn-secondary">
                {t("actions.clearTemplate")}
              </Link>
            ) : null}
          </>
        }
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{t("pages.createEvent.entry.title")}</h2>
            <p className="mt-1 text-sm text-slate-600">{t("pages.createEvent.entry.description")}</p>
          </div>
          {selectedModeConfig ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {selectedModeConfig.label}
            </span>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setCreationSource("template");
              if (!selectedTemplate) {
                setDynamicFields([]);
              }
            }}
            className={`rounded-2xl border p-4 text-left transition ${
              creationSource === "template"
                ? "border-indigo-300 bg-indigo-50"
                : "border-slate-200 bg-slate-50 hover:border-slate-300"
            }`}
          >
            <p className="text-sm font-semibold text-slate-900">{t("pages.createEvent.entry.templateTitle")}</p>
            <p className="mt-1 text-sm text-slate-600">{t("pages.createEvent.entry.templateDescription")}</p>
          </button>
          <button
            type="button"
            onClick={() => {
              setCreationSource("blank");
              if (selectedTemplate) {
                setDynamicFields([]);
              }
            }}
            className={`rounded-2xl border p-4 text-left transition ${
              creationSource === "blank"
                ? "border-indigo-300 bg-indigo-50"
                : "border-slate-200 bg-slate-50 hover:border-slate-300"
            }`}
          >
            <p className="text-sm font-semibold text-slate-900">{t("pages.createEvent.entry.blankTitle")}</p>
            <p className="mt-1 text-sm text-slate-600">{t("pages.createEvent.entry.blankDescription")}</p>
          </button>
        </div>

        {creationSource === "blank" ? (
          <div className="mt-5 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">{t("pages.createEvent.entry.modeTitle")}</h3>
              <p className="mt-1 text-sm text-slate-600">{t("pages.createEvent.entry.modeDescription")}</p>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              {eventModes.map((mode) => (
                <label
                  key={mode.value}
                  className={`rounded-2xl border p-4 transition ${
                    blankEventMode === mode.value
                      ? "border-indigo-300 bg-indigo-50"
                      : "border-slate-200 bg-slate-50 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="eventModeChoice"
                    checked={blankEventMode === mode.value}
                    onChange={() => setBlankEventMode(mode.value)}
                    className="sr-only"
                  />
                  <p className="text-sm font-semibold text-slate-900">{mode.label}</p>
                  <p className="mt-1 text-sm text-slate-600">{mode.description}</p>
                </label>
              ))}
            </div>
          </div>
        ) : selectedTemplate ? (
          <p className="mt-5 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
            {t("pages.createEvent.entry.templateMode", {
              mode: getEventModeConfig(selectedTemplate.snapshot.eventMode).label,
            })}
          </p>
        ) : (
          <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {t("pages.createEvent.entry.selectTemplatePrompt")}
          </p>
        )}
      </div>

      {creationSource === "template" ? (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{t("pages.createEvent.templatesTitle")}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {t("pages.createEvent.templatesDescription")}
            </p>
          </div>
          <p className="text-sm text-slate-500">
            {t("pages.createEvent.templatesCount", { count: templates.length })}
          </p>
        </div>

        {templates.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            {t("pages.createEvent.templatesEmpty")}
          </p>
        ) : (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {templates.map((template) => {
              const isSelected = template.id === selectedTemplateId;
              const sections = getTemplateSectionSummaries(template.snapshot);
              const coverage = getTemplateCoverageSummary(template.snapshot);

              return (
                <article key={template.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{template.name}</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        {getEventModeConfig(template.snapshot.eventMode).label} •{" "}
                        {getTemplateCategoryLabel(template.category)} •{" "}
                        {getTemplateSourceLabel(template.source)} •{" "}
                        {template.description || t("pages.createEvent.noDescription")}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        template.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {template.isActive ? t("status.ACTIVE") : t("status.INACTIVE")}
                    </span>
                  </div>

                  <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex flex-wrap gap-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <span>{coverage.sectionCount} sections</span>
                      <span>{coverage.fieldCount} starter fields</span>
                      {coverage.attendeeFieldCount > 0 ? (
                        <span>{coverage.attendeeFieldCount} attendee-level</span>
                      ) : null}
                    </div>
                    {sections.length > 0 ? (
                      <p className="mt-2 text-xs text-slate-600">
                        Includes: {sections.join(", ")}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-slate-600">
                        {t("pages.createEvent.dynamicFieldCount", { count: template.snapshot.dynamicFields.length })}
                      </p>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={`/admin/events/new?template=${template.id}`}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                        isSelected
                          ? "bg-indigo-600 text-white"
                          : "border border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                      }`}
                    >
                      {isSelected ? t("pages.createEvent.loaded") : t("pages.createEvent.loadTemplate")}
                    </Link>
                    <Link
                      href={`/admin/events/templates/${template.id}`}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-400 hover:text-slate-900"
                    >
                      View Template
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <ol className="grid gap-3 md:grid-cols-3">
          {STEPS.map((step, index) => {
            const isActive = index === currentStep;
            const isComplete = index < currentStep;

            return (
              <li
                key={step.titleKey}
                className={`rounded-xl border p-3 ${
                  isActive
                    ? "border-indigo-300 bg-indigo-50"
                    : isComplete
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-slate-200 bg-slate-50"
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("pages.createEvent.steps.step", { number: index + 1 })}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{t(step.titleKey)}</p>
                <p className="mt-1 text-xs text-slate-600">{t(step.descriptionKey)}</p>
              </li>
            );
          })}
        </ol>
      </div>

      {created ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {t("pages.createEvent.created")}
        </p>
      ) : null}

      {creationSource === "template" && selectedTemplate ? (
        <p className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
          {t("pages.createEvent.loadedTemplate", {
            name: selectedTemplate.name,
            mode: getEventModeConfig(selectedTemplate.snapshot.eventMode).label,
          })}
        </p>
      ) : null}

      {clientValidationMessage ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {clientValidationMessage}
        </p>
      ) : null}

      {formState.status === "error" && formState.message ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {formState.message}
        </p>
      ) : null}

      {templateState.status === "error" && templateState.message ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {templateState.message}
        </p>
      ) : null}

      {templateState.status === "success" && templateState.message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {templateState.message}
        </p>
      ) : null}

      <form
        action={formAction}
        className="space-y-6"
        onSubmit={(event) => {
          const validationError = validateBeforeSubmit();
          setClientValidationMessage(validationError);

          if (validationError) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="dynamicFieldsJson" value={serializedFields} readOnly />
        {creationSource === "blank" ? <input type="hidden" name="eventMode" value={selectedEventMode ?? ""} readOnly /> : null}
        {creationSource === "template" && selectedTemplate ? <input type="hidden" name="templateId" value={selectedTemplate.id} readOnly /> : null}

        <div
          className={`space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${
            currentStep === 0 ? "" : "hidden"
          }`}
        >
          <h2 className="text-xl font-semibold text-slate-900">{t("pages.createEvent.wizard.eventBasics")}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
              <span>{t("pages.createEvent.wizard.eventName")}</span>
              <input
                name="name"
                type="text"
                required
                defaultValue={selectedTemplate?.snapshot.name ?? ""}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder={t("pages.createEvent.wizard.eventNamePlaceholder")}
              />
            </label>

            <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
              <span>{t("pages.createEvent.wizard.description")}</span>
              <textarea
                name="description"
                rows={3}
                defaultValue={selectedTemplate?.snapshot.description ?? ""}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder={t("pages.createEvent.wizard.descriptionPlaceholder")}
              />
            </label>

            <label className="space-y-1 text-sm text-slate-700">
              <span>{t("pages.createEvent.wizard.startsAt")}</span>
              <input
                name="startsAt"
                type="datetime-local"
                required
                defaultValue={selectedTemplate?.snapshot.startsAt ?? ""}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="space-y-1 text-sm text-slate-700">
              <span>{t("pages.createEvent.wizard.endsAt")}</span>
              <input
                name="endsAt"
                type="datetime-local"
                required
                defaultValue={selectedTemplate?.snapshot.endsAt ?? ""}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
          </div>
        </div>

        <div
          className={`space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${
            currentStep === 1 ? "" : "hidden"
          }`}
        >
          <h2 className="text-xl font-semibold text-slate-900">{t("pages.createEvent.wizard.registrationTitle")}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm text-slate-700">
              <span>{t("pages.createEvent.wizard.registrationOpens")}</span>
              <input
                name="registrationOpensAt"
                type="datetime-local"
                required
                defaultValue={selectedTemplate?.snapshot.registrationOpensAt ?? ""}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="space-y-1 text-sm text-slate-700">
              <span>{t("pages.createEvent.wizard.registrationCloses")}</span>
              <input
                name="registrationClosesAt"
                type="datetime-local"
                required
                defaultValue={selectedTemplate?.snapshot.registrationClosesAt ?? ""}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="space-y-1 text-sm text-slate-700">
              <span>{t("pages.createEvent.wizard.basePrice")}</span>
              <input
                name="basePrice"
                type="number"
                min="0"
                step="0.01"
                required
                defaultValue={selectedTemplate?.snapshot.basePrice ?? ""}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="35.00"
              />
            </label>

            <label className="space-y-1 text-sm text-slate-700">
              <span>{t("pages.createEvent.wizard.lateFeePrice")}</span>
              <input
                name="lateFeePrice"
                type="number"
                min="0"
                step="0.01"
                required
                defaultValue={selectedTemplate?.snapshot.lateFeePrice ?? ""}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="50.00"
              />
            </label>

            <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
              <span>{t("pages.createEvent.wizard.lateFeeStarts")}</span>
              <input
                name="lateFeeStartsAt"
                type="datetime-local"
                required
                defaultValue={selectedTemplate?.snapshot.lateFeeStartsAt ?? ""}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="space-y-1 text-sm text-slate-700">
              <span>{t("pages.createEvent.wizard.locationName")}</span>
              <input
                name="locationName"
                type="text"
                defaultValue={selectedTemplate?.snapshot.locationName ?? ""}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder={t("pages.createEvent.wizard.locationNamePlaceholder")}
              />
            </label>

            <label className="space-y-1 text-sm text-slate-700">
              <span>{t("pages.createEvent.wizard.locationAddress")}</span>
              <input
                name="locationAddress"
                type="text"
                defaultValue={selectedTemplate?.snapshot.locationAddress ?? ""}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder={t("pages.createEvent.wizard.locationAddressPlaceholder")}
              />
            </label>
          </div>
        </div>

        {currentStep === 2 ? (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-slate-900">Registration Form</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Build the questions directors will answer when they register for this event.
                </p>
              </div>
              {selectedModeConfig ? (
                <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">{selectedModeConfig.label}</p>
                  <p className="mt-1">{selectedModeConfig.description}</p>
                </div>
              ) : null}
              <DynamicFormBuilder fields={dynamicFields} onChange={setDynamicFields} />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-slate-900">{t("pages.createEvent.wizard.saveAsTemplate")}</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {t("pages.createEvent.wizard.saveAsTemplateDescription")}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1 text-sm text-slate-700">
                  <span>{t("pages.createEvent.wizard.templateName")}</span>
                  <input
                    name="templateName"
                    type="text"
                    defaultValue={selectedTemplate?.name ?? selectedTemplate?.snapshot.name ?? ""}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    placeholder={t("pages.createEvent.wizard.templateNamePlaceholder")}
                  />
                </label>

                <label className="space-y-1 text-sm text-slate-700">
                  <span>{t("pages.createEvent.wizard.templateDescription")}</span>
                  <input
                    name="templateDescription"
                    type="text"
                    defaultValue={selectedTemplate?.description ?? ""}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    placeholder={t("pages.createEvent.wizard.templateDescriptionPlaceholder")}
                  />
                </label>

                <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 md:col-span-2">
                  <input
                    name="templateIsActive"
                    type="checkbox"
                    defaultChecked={selectedTemplate ? selectedTemplate.isActive : true}
                  />
                  {t("pages.createEvent.wizard.templateActive")}
                </label>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <button
              type="button"
              disabled={currentStep === 0}
              onClick={() => setCurrentStep((step) => Math.max(0, step - 1))}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("pages.createEvent.wizard.back")}
            </button>
            {currentStep < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((step) => Math.min(STEPS.length - 1, step + 1))}
                className="rounded-lg border border-indigo-300 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
              >
                {t("pages.createEvent.wizard.next")}
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {currentStep === 2 ? (
              <button
                type="submit"
                formAction={templateFormAction}
                className="rounded-lg border border-indigo-300 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
              >
                {selectedTemplate ? t("pages.createEvent.wizard.updateTemplate") : t("pages.createEvent.wizard.saveTemplate")}
              </button>
            ) : null}
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              {t("actions.createEvent")}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
