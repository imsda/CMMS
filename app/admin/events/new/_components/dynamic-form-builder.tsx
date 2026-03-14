"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { type EventFieldConditionalOperator } from "../../../../../lib/event-form-config";
import {
  getAllowedDynamicFieldTypes,
  typeAllowsOptions,
} from "../../../../../lib/event-form-fields";

export type SupportedFormFieldType =
  | "SHORT_TEXT"
  | "LONG_TEXT"
  | "DATE"
  | "SINGLE_SELECT"
  | "MULTI_SELECT"
  | "BOOLEAN"
  | "NUMBER"
  | "ROSTER_SELECT"
  | "ROSTER_MULTI_SELECT"
  | "FIELD_GROUP";

export type DynamicFieldDraft = {
  id: string;
  parentFieldId: string | null;
  key: string;
  label: string;
  description: string;
  type: SupportedFormFieldType;
  fieldScope: "GLOBAL" | "ATTENDEE";
  isRequired: boolean;
  options: string[];
  conditionalFieldKey: string;
  conditionalOperator: EventFieldConditionalOperator | "";
  conditionalValue: string;
};

type DynamicFormBuilderProps = {
  fields: DynamicFieldDraft[];
  onChange: (fields: DynamicFieldDraft[]) => void;
};

type NewFieldPreset = {
  type: SupportedFormFieldType;
  fieldScope?: DynamicFieldDraft["fieldScope"];
};

const DEFAULT_TYPE: SupportedFormFieldType = "SHORT_TEXT";

const FIELD_TYPE_ORDER: SupportedFormFieldType[] = [
  "SHORT_TEXT",
  "LONG_TEXT",
  "DATE",
  "SINGLE_SELECT",
  "MULTI_SELECT",
  "BOOLEAN",
  "NUMBER",
  "ROSTER_SELECT",
  "ROSTER_MULTI_SELECT",
  "FIELD_GROUP",
];

const FIELD_TYPE_TONES: Record<SupportedFormFieldType, string> = {
  SHORT_TEXT: "bg-sky-100 text-sky-800",
  LONG_TEXT: "bg-cyan-100 text-cyan-800",
  DATE: "bg-emerald-100 text-emerald-800",
  SINGLE_SELECT: "bg-blue-100 text-blue-800",
  MULTI_SELECT: "bg-indigo-100 text-indigo-800",
  BOOLEAN: "bg-amber-100 text-amber-800",
  NUMBER: "bg-violet-100 text-violet-800",
  ROSTER_SELECT: "bg-rose-100 text-rose-800",
  ROSTER_MULTI_SELECT: "bg-fuchsia-100 text-fuchsia-800",
  FIELD_GROUP: "bg-slate-200 text-slate-800",
};

function createEmptyField(
  parentFieldId: string | null = null,
  preset: NewFieldPreset = { type: DEFAULT_TYPE },
): DynamicFieldDraft {
  return {
    id: crypto.randomUUID(),
    parentFieldId,
    key: "",
    label: "",
    description: "",
    type: preset.type,
    fieldScope: preset.type === "FIELD_GROUP" ? "GLOBAL" : preset.fieldScope ?? "GLOBAL",
    isRequired: false,
    options: [],
    conditionalFieldKey: "",
    conditionalOperator: "",
    conditionalValue: "",
  };
}

function toSuggestedKey(label: string) {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

function getFieldTone(type: SupportedFormFieldType) {
  return FIELD_TYPE_TONES[type];
}

function getFieldTypeList(parentFieldId: string | null) {
  const allowed = new Set(getAllowedDynamicFieldTypes(parentFieldId));
  return FIELD_TYPE_ORDER.filter((type) => allowed.has(type));
}

export function DynamicFormBuilder({ fields, onChange }: DynamicFormBuilderProps) {
  const t = useTranslations("Admin");
  const [optionDrafts, setOptionDrafts] = useState<Record<string, string>>({});

  const groups = useMemo(
    () => fields.filter((field) => field.type === "FIELD_GROUP" && field.parentFieldId === null),
    [fields],
  );

  const rootQuestions = useMemo(
    () => fields.filter((field) => field.type !== "FIELD_GROUP" && field.parentFieldId === null),
    [fields],
  );

  const globalDependencyOptions = useMemo(
    () =>
      fields
        .filter((field) => field.type !== "FIELD_GROUP" && field.fieldScope === "GLOBAL")
        .map((field) => ({
          id: field.id,
          key: field.key,
          label: field.label,
        })),
    [fields],
  );

  function updateField(id: string, updates: Partial<DynamicFieldDraft>) {
    onChange(fields.map((field) => (field.id === id ? { ...field, ...updates } : field)));
  }

  function addField(parentFieldId: string | null, preset: NewFieldPreset) {
    onChange([...fields, createEmptyField(parentFieldId, preset)]);
  }

  function removeField(id: string) {
    const childIds = new Set(
      fields.filter((field) => field.parentFieldId === id).map((field) => field.id),
    );

    onChange(fields.filter((field) => field.id !== id && !childIds.has(field.id)));

    setOptionDrafts((current) => {
      const next = { ...current };
      delete next[id];
      for (const childId of childIds) {
        delete next[childId];
      }
      return next;
    });
  }

  function moveField(id: string, direction: "up" | "down") {
    const target = fields.find((field) => field.id === id);
    if (!target) {
      return;
    }

    const siblingIds = fields
      .filter((field) => field.parentFieldId === target.parentFieldId)
      .map((field) => field.id);

    const currentSiblingIndex = siblingIds.indexOf(id);
    if (currentSiblingIndex === -1) {
      return;
    }

    const swapWithSiblingIndex =
      direction === "up" ? currentSiblingIndex - 1 : currentSiblingIndex + 1;

    if (swapWithSiblingIndex < 0 || swapWithSiblingIndex >= siblingIds.length) {
      return;
    }

    const swapWithId = siblingIds[swapWithSiblingIndex];
    const fullOrderIds = fields.map((field) => field.id);
    const fromIndex = fullOrderIds.indexOf(id);
    const toIndex = fullOrderIds.indexOf(swapWithId);

    if (fromIndex === -1 || toIndex === -1) {
      return;
    }

    const nextFields = [...fields];
    [nextFields[fromIndex], nextFields[toIndex]] = [nextFields[toIndex], nextFields[fromIndex]];
    onChange(nextFields);
  }

  function addOption(field: DynamicFieldDraft) {
    const draft = (optionDrafts[field.id] ?? "").trim();
    if (!draft) {
      return;
    }

    if (field.options.some((option) => option.toLowerCase() === draft.toLowerCase())) {
      return;
    }

    updateField(field.id, { options: [...field.options, draft] });
    setOptionDrafts((current) => ({ ...current, [field.id]: "" }));
  }

  function removeOption(field: DynamicFieldDraft, option: string) {
    updateField(field.id, {
      options: field.options.filter((item) => item !== option),
    });
  }

  function moveOption(field: DynamicFieldDraft, optionIndex: number, direction: "up" | "down") {
    const nextIndex = direction === "up" ? optionIndex - 1 : optionIndex + 1;
    if (nextIndex < 0 || nextIndex >= field.options.length) {
      return;
    }

    const nextOptions = [...field.options];
    [nextOptions[optionIndex], nextOptions[nextIndex]] = [nextOptions[nextIndex], nextOptions[optionIndex]];
    updateField(field.id, { options: nextOptions });
  }

  function toggleOtherOption(field: DynamicFieldDraft) {
    const hasOther = field.options.includes("Other");

    updateField(field.id, {
      options: hasOther ? field.options.filter((option) => option !== "Other") : [...field.options, "Other"],
    });
  }

  function renderQuestionControls(field: DynamicFieldDraft, isSection: boolean) {
    const allowedTypes = getFieldTypeList(field.parentFieldId);
    const fieldTypeLabel = t(`pages.dynamicBuilder.typeOptions.${field.type}`);
    const fieldIntentLabel = isSection
      ? t("pages.dynamicBuilder.sectionIntent")
      : field.fieldScope === "ATTENDEE"
        ? t("pages.dynamicBuilder.attendeeIntent")
        : t("pages.dynamicBuilder.questionIntent");
    const hasConditionalVisibility =
      field.conditionalFieldKey.length > 0 || field.conditionalOperator.length > 0;

    return (
      <>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(220px,0.7fr)]">
          <div className="space-y-4">
            <label className="space-y-1.5 text-sm text-slate-700">
              <span className="font-medium">
                {isSection ? t("pages.dynamicBuilder.sectionTitleLabel") : t("pages.dynamicBuilder.questionLabelText")}
              </span>
              <input
                type="text"
                value={field.label}
                onChange={(event) => {
                  const nextLabel = event.currentTarget.value;
                  const updates: Partial<DynamicFieldDraft> = { label: nextLabel };

                  if (field.key.trim().length === 0) {
                    updates.key = toSuggestedKey(nextLabel);
                  }

                  updateField(field.id, updates);
                }}
                placeholder={
                  isSection
                    ? t("pages.dynamicBuilder.sectionTitlePlaceholder")
                    : t("pages.dynamicBuilder.questionPlaceholder")
                }
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
              />
            </label>

            <label className="space-y-1.5 text-sm text-slate-700">
              <span className="font-medium">
                {isSection ? t("pages.dynamicBuilder.helpTextLabel") : t("pages.dynamicBuilder.helpTextLabel")}
              </span>
              <textarea
                value={field.description}
                onChange={(event) => updateField(field.id, { description: event.currentTarget.value })}
                placeholder={
                  isSection
                    ? t("pages.dynamicBuilder.sectionHelpTextPlaceholder")
                    : t("pages.dynamicBuilder.descriptionPlaceholder")
                }
                rows={isSection ? 2 : 3}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
              />
            </label>
          </div>

          <div className="space-y-4 rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {t("pages.dynamicBuilder.answerStyle")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getFieldTone(field.type)}`}>
                  {fieldTypeLabel}
                </span>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                  {fieldIntentLabel}
                </span>
              </div>
            </div>

            {!isSection ? (
              <label className="space-y-1.5 text-sm text-slate-700">
                <span className="font-medium">{t("pages.dynamicBuilder.answerTypeLabel")}</span>
                <select
                  value={field.type}
                  onChange={(event) => {
                    const nextType = event.currentTarget.value as SupportedFormFieldType;
                    updateField(field.id, {
                      type: nextType,
                      options: typeAllowsOptions(nextType) ? field.options : [],
                    });
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"
                >
                  {allowedTypes.map((type) => (
                    <option key={`${field.id}-${type}`} value={type}>
                      {t(`pages.dynamicBuilder.typeOptions.${type}`)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {!isSection ? (
              <label className="flex items-center justify-between gap-3 rounded-xl border border-white/80 bg-white px-3 py-3 text-sm text-slate-700">
                <div>
                  <p className="font-medium text-slate-900">{t("pages.dynamicBuilder.required")}</p>
                  <p className="text-xs text-slate-500">{t("pages.dynamicBuilder.requiredHint")}</p>
                </div>
                <input
                  type="checkbox"
                  checked={field.isRequired}
                  onChange={(event) => updateField(field.id, { isRequired: event.currentTarget.checked })}
                />
              </label>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-3 text-sm text-slate-600">
                {t("pages.dynamicBuilder.sectionBadgeDescription")}
              </div>
            )}
          </div>
        </div>

        {typeAllowsOptions(field.type) ? (
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h5 className="text-sm font-semibold text-slate-900">{t("pages.dynamicBuilder.optionsTitle")}</h5>
                <p className="mt-1 text-sm text-slate-600">
                  {field.type === "SINGLE_SELECT"
                    ? t("pages.dynamicBuilder.optionsDescriptionSingle")
                    : t("pages.dynamicBuilder.optionsDescriptionMulti")}
                </p>
              </div>
              <label className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={field.options.includes("Other")}
                  onChange={() => toggleOtherOption(field)}
                />
                {t("pages.dynamicBuilder.includeOther")}
              </label>
            </div>

            <div className="mt-4 flex gap-2">
              <input
                type="text"
                value={optionDrafts[field.id] ?? ""}
                onChange={(event) =>
                  setOptionDrafts((current) => ({
                    ...current,
                    [field.id]: event.currentTarget.value,
                  }))
                }
                placeholder={t("pages.dynamicBuilder.addOptionPlaceholder")}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              />
              <button
                type="button"
                onClick={() => addOption(field)}
                className="btn-secondary"
              >
                {t("pages.dynamicBuilder.addOptionAction")}
              </button>
            </div>

            {field.options.length === 0 ? (
              <p className="mt-3 text-xs text-slate-500">{t("pages.dynamicBuilder.addAtLeastOneOption")}</p>
            ) : (
              <div className="mt-4 space-y-2">
                {field.options.map((option, optionIndex) => (
                  <div
                    key={`${field.id}-option-${option}`}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-500">
                      {optionIndex + 1}
                    </span>
                    <span className="min-w-0 flex-1 text-sm text-slate-800">{option}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => moveOption(field, optionIndex, "up")}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-white"
                      >
                        {t("pages.dynamicBuilder.up")}
                      </button>
                      <button
                        type="button"
                        onClick={() => moveOption(field, optionIndex, "down")}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-white"
                      >
                        {t("pages.dynamicBuilder.down")}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeOption(field, option)}
                        className="rounded-lg border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                      >
                        {t("pages.dynamicBuilder.remove")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        <details className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4">
          <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">
            {t("pages.dynamicBuilder.advancedSettings")}
          </summary>

          <div className="mt-4 space-y-4">
            {!isSection ? (
              <label className="space-y-1.5 text-sm text-slate-700">
                <span className="font-medium">{t("pages.dynamicBuilder.audienceLabel")}</span>
                <select
                  value={field.fieldScope}
                  onChange={(event) =>
                    updateField(field.id, {
                      fieldScope: event.currentTarget.value as DynamicFieldDraft["fieldScope"],
                    })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"
                >
                  <option value="GLOBAL">{t("pages.dynamicBuilder.scopeOptions.GLOBAL")}</option>
                  <option value="ATTENDEE">{t("pages.dynamicBuilder.scopeOptions.ATTENDEE")}</option>
                </select>
              </label>
            ) : null}

            <label className="space-y-1.5 text-sm text-slate-700">
              <span className="font-medium">{t("pages.dynamicBuilder.key")}</span>
              <input
                type="text"
                value={field.key}
                onChange={(event) => updateField(field.id, { key: event.currentTarget.value })}
                placeholder={isSection ? "travel_details" : "arrival_date"}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"
              />
              <p className="text-xs text-slate-500">{t("pages.dynamicBuilder.keyDescription")}</p>
            </label>

            <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {t("pages.dynamicBuilder.conditionalVisibility")}
                  </p>
                  <p className="text-xs text-slate-500">
                    {isSection
                      ? t("pages.dynamicBuilder.conditionalDescriptionSection")
                      : t("pages.dynamicBuilder.conditionalDescriptionField")}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={hasConditionalVisibility}
                    onChange={(event) =>
                      updateField(field.id, {
                        conditionalFieldKey: event.currentTarget.checked ? field.conditionalFieldKey : "",
                        conditionalOperator: event.currentTarget.checked
                          ? field.conditionalOperator || "equals"
                          : "",
                        conditionalValue: event.currentTarget.checked ? field.conditionalValue : "",
                      })
                    }
                  />
                  {t("pages.dynamicBuilder.enabled")}
                </label>
              </div>

              {hasConditionalVisibility ? (
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <label className="space-y-1.5 text-sm text-slate-700">
                    <span>{t("pages.dynamicBuilder.dependsOn")}</span>
                    <select
                      value={field.conditionalFieldKey}
                      onChange={(event) =>
                        updateField(field.id, { conditionalFieldKey: event.currentTarget.value })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"
                    >
                      <option value="">{t("pages.dynamicBuilder.selectGlobalField")}</option>
                      {globalDependencyOptions
                        .filter((candidate) => candidate.id !== field.id)
                        .map((candidate) => (
                          <option key={`${field.id}-cond-${candidate.id}`} value={candidate.key}>
                            {candidate.label || candidate.key}
                          </option>
                        ))}
                    </select>
                  </label>

                  <label className="space-y-1.5 text-sm text-slate-700">
                    <span>{t("pages.dynamicBuilder.operator")}</span>
                    <select
                      value={field.conditionalOperator || "equals"}
                      onChange={(event) =>
                        updateField(field.id, {
                          conditionalOperator: event.currentTarget.value as EventFieldConditionalOperator,
                        })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"
                    >
                      <option value="equals">{t("pages.dynamicBuilder.operators.equals")}</option>
                      <option value="not_equals">{t("pages.dynamicBuilder.operators.not_equals")}</option>
                      <option value="includes">{t("pages.dynamicBuilder.operators.includes")}</option>
                      <option value="not_includes">{t("pages.dynamicBuilder.operators.not_includes")}</option>
                      <option value="truthy">{t("pages.dynamicBuilder.operators.truthy")}</option>
                      <option value="falsy">{t("pages.dynamicBuilder.operators.falsy")}</option>
                    </select>
                  </label>

                  {field.conditionalOperator === "truthy" || field.conditionalOperator === "falsy" ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-500">
                      {t("pages.dynamicBuilder.noComparisonValue")}
                    </div>
                  ) : (
                    <label className="space-y-1.5 text-sm text-slate-700">
                      <span>{t("pages.dynamicBuilder.value")}</span>
                      <input
                        type="text"
                        value={field.conditionalValue}
                        onChange={(event) =>
                          updateField(field.id, { conditionalValue: event.currentTarget.value })
                        }
                        placeholder={t("pages.dynamicBuilder.valuePlaceholder")}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"
                      />
                    </label>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </details>
      </>
    );
  }

  function renderFieldCard(field: DynamicFieldDraft, indexLabel: string) {
    const isSection = field.type === "FIELD_GROUP";

    return (
      <article
        key={field.id}
        className={`space-y-4 rounded-[1.75rem] border p-5 shadow-sm ${
          isSection
            ? "border-blue-200 bg-gradient-to-br from-blue-50 to-white"
            : "border-slate-200 bg-white"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                {indexLabel}
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getFieldTone(field.type)}`}>
                {t(`pages.dynamicBuilder.typeOptions.${field.type}`)}
              </span>
              {!isSection ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {field.fieldScope === "ATTENDEE"
                    ? t("pages.dynamicBuilder.attendeeIntent")
                    : t("pages.dynamicBuilder.questionIntent")}
                </span>
              ) : null}
            </div>

            <div>
              <h4 className="text-lg font-semibold text-slate-900">
                {field.label.trim().length > 0
                  ? field.label
                  : isSection
                    ? t("pages.dynamicBuilder.untitledSection")
                    : t("pages.dynamicBuilder.untitledQuestion")}
              </h4>
              <p className="mt-1 text-sm text-slate-600">
                {isSection
                  ? t("pages.dynamicBuilder.sectionCardDescription")
                  : t("pages.dynamicBuilder.fieldCardDescription")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => moveField(field.id, "up")}
              className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              {t("pages.dynamicBuilder.up")}
            </button>
            <button
              type="button"
              onClick={() => moveField(field.id, "down")}
              className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              {t("pages.dynamicBuilder.down")}
            </button>
            <button
              type="button"
              onClick={() => removeField(field.id)}
              className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
            >
              {t("pages.dynamicBuilder.remove")}
            </button>
          </div>
        </div>

        {renderQuestionControls(field, isSection)}

        {isSection ? (
          <div className="rounded-[1.5rem] border border-dashed border-blue-200 bg-white/80 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h5 className="text-sm font-semibold text-slate-900">
                  {t("pages.dynamicBuilder.sectionQuestionsTitle")}
                </h5>
                <p className="mt-1 text-sm text-slate-600">
                  {t("pages.dynamicBuilder.sectionQuestionsDescription")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => addField(field.id, { type: "SHORT_TEXT", fieldScope: "GLOBAL" })}
                  className="btn-secondary"
                >
                  {t("pages.dynamicBuilder.addQuestion")}
                </button>
                <button
                  type="button"
                  onClick={() => addField(field.id, { type: "SHORT_TEXT", fieldScope: "ATTENDEE" })}
                  className="btn-secondary"
                >
                  {t("pages.dynamicBuilder.addAttendeeField")}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </article>
    );
  }

  const hasFields = fields.length > 0;

  return (
    <div className="space-y-5">
      <div className="rounded-[1.9rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
                {t("pages.dynamicBuilder.builderBadge")}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {t("pages.dynamicBuilder.builderSubtitle")}
              </span>
            </div>
            <div>
              <h3 className="text-2xl font-semibold text-slate-900">{t("pages.dynamicBuilder.title")}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {t("pages.dynamicBuilder.description")}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => addField(null, { type: "SHORT_TEXT", fieldScope: "GLOBAL" })}
              className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-blue-300 hover:bg-blue-50"
            >
              <p className="text-sm font-semibold text-slate-900">{t("pages.dynamicBuilder.addQuestion")}</p>
              <p className="mt-1 text-xs text-slate-600">{t("pages.dynamicBuilder.addQuestionDescription")}</p>
            </button>
            <button
              type="button"
              onClick={() => addField(null, { type: "SHORT_TEXT", fieldScope: "ATTENDEE" })}
              className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-blue-300 hover:bg-blue-50"
            >
              <p className="text-sm font-semibold text-slate-900">{t("pages.dynamicBuilder.addAttendeeField")}</p>
              <p className="mt-1 text-xs text-slate-600">
                {t("pages.dynamicBuilder.addAttendeeFieldDescription")}
              </p>
            </button>
            <button
              type="button"
              onClick={() => addField(null, { type: "FIELD_GROUP" })}
              className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-blue-300 hover:bg-blue-50"
            >
              <p className="text-sm font-semibold text-slate-900">{t("pages.dynamicBuilder.addSection")}</p>
              <p className="mt-1 text-xs text-slate-600">{t("pages.dynamicBuilder.addSectionDescription")}</p>
            </button>
          </div>
        </div>
      </div>

      {!hasFields ? (
        <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white/70 p-8 text-center">
          <p className="text-lg font-semibold text-slate-900">{t("pages.dynamicBuilder.emptyTitle")}</p>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            {t("pages.dynamicBuilder.empty")}
          </p>
        </div>
      ) : null}

      {rootQuestions.length > 0 ? (
        <section className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
              {t("pages.dynamicBuilder.topLevelQuestions")}
            </h4>
            <p className="mt-1 text-sm text-slate-600">
              {t("pages.dynamicBuilder.topLevelQuestionsDescription")}
            </p>
          </div>
          {rootQuestions.map((field, index) =>
            renderFieldCard(field, t("pages.dynamicBuilder.questionLabel", { number: index + 1 })),
          )}
        </section>
      ) : null}

      {groups.length > 0 ? (
        <section className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
              {t("pages.dynamicBuilder.sectionsTitle")}
            </h4>
            <p className="mt-1 text-sm text-slate-600">
              {t("pages.dynamicBuilder.sectionsDescription")}
            </p>
          </div>

          {groups.map((group, index) => {
            const children = fields.filter((field) => field.parentFieldId === group.id);

            return (
              <div
                key={group.id}
                className="space-y-4 rounded-[2rem] border border-blue-200 bg-gradient-to-br from-blue-50/90 to-white p-4 shadow-sm"
              >
                {renderFieldCard(group, t("pages.dynamicBuilder.fieldGroupLabel", { number: index + 1 }))}

                <div className="space-y-3 pl-0 md:pl-5">
                  {children.length === 0 ? (
                    <p className="rounded-[1.5rem] border border-dashed border-blue-200 bg-white p-4 text-sm text-slate-500">
                      {t("pages.dynamicBuilder.addChildFieldsHint")}
                    </p>
                  ) : (
                    children.map((child, childIndex) =>
                      renderFieldCard(child, t("pages.dynamicBuilder.childLabel", { number: childIndex + 1 })),
                    )
                  )}
                </div>
              </div>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
