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

const DEFAULT_TYPE: SupportedFormFieldType = "SHORT_TEXT";

function createEmptyField(
  parentFieldId: string | null = null,
  type: SupportedFormFieldType = DEFAULT_TYPE,
): DynamicFieldDraft {
  return {
    id: crypto.randomUUID(),
    parentFieldId,
    key: "",
    label: "",
    description: "",
    type,
    fieldScope: "GLOBAL",
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

  function addTopLevelQuestion() {
    onChange([...fields, createEmptyField(null)]);
  }

  function addFieldGroup() {
    onChange([...fields, createEmptyField(null, "FIELD_GROUP")]);
  }

  function addChildField(groupId: string) {
    onChange([...fields, createEmptyField(groupId)]);
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

  function renderFieldCard(field: DynamicFieldDraft, indexLabel: string) {
    const isGroup = field.type === "FIELD_GROUP";
    const hasConditionalVisibility = field.conditionalFieldKey.length > 0 || field.conditionalOperator.length > 0;
    const allowedTypes = getAllowedDynamicFieldTypes(field.parentFieldId);

    return (
      <article key={field.id} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-900">{indexLabel}</h4>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => moveField(field.id, "up")}
              className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              {t("pages.dynamicBuilder.up")}
            </button>
            <button
              type="button"
              onClick={() => moveField(field.id, "down")}
              className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              {t("pages.dynamicBuilder.down")}
            </button>
            <button
              type="button"
              onClick={() => removeField(field.id)}
              className="text-sm font-medium text-rose-600 hover:text-rose-700"
            >
              {t("pages.dynamicBuilder.remove")}
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm text-slate-700">
            <span>{t("pages.dynamicBuilder.key")}</span>
            <input
              type="text"
              value={field.key}
              onChange={(event) => updateField(field.id, { key: event.currentTarget.value })}
              placeholder={isGroup ? "meals_group" : "meal_count"}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="space-y-1 text-sm text-slate-700">
            <span>{t("pages.dynamicBuilder.label")}</span>
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
              placeholder={isGroup ? "Meals" : "How many meals?"}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
        </div>

        <label className="block space-y-1 text-sm text-slate-700">
          <span>{t("pages.dynamicBuilder.descriptionLabel")}</span>
          <input
            type="text"
            value={field.description}
            onChange={(event) => updateField(field.id, { description: event.currentTarget.value })}
            placeholder={t("pages.dynamicBuilder.descriptionPlaceholder")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-1 text-sm text-slate-700">
            <span>{t("pages.dynamicBuilder.type")}</span>
            <select
              value={field.type}
              onChange={(event) => {
                const nextType = event.currentTarget.value as SupportedFormFieldType;
                updateField(field.id, {
                  type: nextType,
                  fieldScope: nextType === "FIELD_GROUP" ? "GLOBAL" : field.fieldScope,
                  options: typeAllowsOptions(nextType) ? field.options : [],
                  isRequired: nextType === "FIELD_GROUP" ? false : field.isRequired,
                  conditionalFieldKey: field.conditionalFieldKey,
                  conditionalOperator: field.conditionalOperator,
                  conditionalValue: field.conditionalValue,
                });
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              {allowedTypes.map((type) => (
                <option key={`${field.id}-${type}`} value={type}>
                  {t(`pages.dynamicBuilder.typeOptions.${type}`)}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm text-slate-700">
            <span>{t("pages.dynamicBuilder.scope")}</span>
            <select
              value={isGroup ? "GLOBAL" : field.fieldScope}
              onChange={(event) =>
                updateField(field.id, {
                  fieldScope: event.currentTarget.value as DynamicFieldDraft["fieldScope"],
                })
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              disabled={isGroup}
            >
              <option value="GLOBAL">{t("pages.dynamicBuilder.scopeOptions.GLOBAL")}</option>
              <option value="ATTENDEE">{t("pages.dynamicBuilder.scopeOptions.ATTENDEE")}</option>
            </select>
          </label>

          <label className="flex items-center gap-2 self-end rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={field.isRequired}
              disabled={isGroup}
              onChange={(event) => updateField(field.id, { isRequired: event.currentTarget.checked })}
            />
            {t("pages.dynamicBuilder.required")}
          </label>
        </div>

        {typeAllowsOptions(field.type) ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">{t("pages.dynamicBuilder.options")}</p>
            <div className="flex gap-2">
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
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => addOption(field)}
                className="rounded-lg border border-indigo-300 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
              >
                {t("pages.dynamicBuilder.add")}
              </button>
            </div>

            {field.options.length === 0 ? (
              <p className="text-xs text-slate-500">{t("pages.dynamicBuilder.addAtLeastOneOption")}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {field.options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => removeOption(field, option)}
                    className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs text-slate-700 hover:border-rose-300 hover:text-rose-700"
                  >
                    {option} ×
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}

        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-700">{t("pages.dynamicBuilder.conditionalVisibility")}</p>
              <p className="text-xs text-slate-500">
                {isGroup
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
            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1 text-sm text-slate-700">
                <span>{t("pages.dynamicBuilder.dependsOn")}</span>
                <select
                  value={field.conditionalFieldKey}
                  onChange={(event) => updateField(field.id, { conditionalFieldKey: event.currentTarget.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
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

              <label className="space-y-1 text-sm text-slate-700">
                <span>{t("pages.dynamicBuilder.operator")}</span>
                <select
                  value={field.conditionalOperator || "equals"}
                  onChange={(event) =>
                    updateField(field.id, {
                      conditionalOperator: event.currentTarget.value as EventFieldConditionalOperator,
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
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
                <div className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-sm text-slate-500">
                  {t("pages.dynamicBuilder.noComparisonValue")}
                </div>
              ) : (
                <label className="space-y-1 text-sm text-slate-700">
                  <span>{t("pages.dynamicBuilder.value")}</span>
                  <input
                    type="text"
                    value={field.conditionalValue}
                    onChange={(event) => updateField(field.id, { conditionalValue: event.currentTarget.value })}
                    placeholder={t("pages.dynamicBuilder.valuePlaceholder")}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
              )}
            </div>
          ) : null}
        </div>

        {isGroup ? (
          <button
            type="button"
            onClick={() => addChildField(field.id)}
            className="rounded-lg border border-indigo-300 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
          >
            {t("pages.dynamicBuilder.addChildField")}
          </button>
        ) : null}
      </article>
    );
  }

  const hasFields = fields.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{t("pages.dynamicBuilder.title")}</h3>
          <p className="text-sm text-slate-600">
            {t("pages.dynamicBuilder.description")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={addTopLevelQuestion}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            {t("pages.dynamicBuilder.addQuestion")}
          </button>
          <button
            type="button"
            onClick={addFieldGroup}
            className="rounded-lg border border-indigo-300 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
          >
            {t("pages.dynamicBuilder.addFieldGroup")}
          </button>
        </div>
      </div>

      {!hasFields ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
          {t("pages.dynamicBuilder.empty")}
        </div>
      ) : null}

      {rootQuestions.map((field, index) => renderFieldCard(field, t("pages.dynamicBuilder.questionLabel", { number: index + 1 })))}

      {groups.map((group, index) => {
        const children = fields.filter((field) => field.parentFieldId === group.id);

        return (
          <div
            key={group.id}
            className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/40 p-3"
          >
            {renderFieldCard(group, t("pages.dynamicBuilder.fieldGroupLabel", { number: index + 1 }))}
            <div className="space-y-3 pl-0 md:pl-4">
              {children.length === 0 ? (
                <p className="rounded-lg border border-dashed border-indigo-200 bg-white p-3 text-xs text-slate-500">
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
    </div>
  );
}
