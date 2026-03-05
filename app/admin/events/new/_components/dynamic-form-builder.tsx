"use client";

import { useMemo, useState } from "react";

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
  isRequired: boolean;
  options: string[];
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
    isRequired: false,
    options: [],
  };
}

function typeAllowsOptions(type: SupportedFormFieldType) {
  return type === "SINGLE_SELECT" || type === "MULTI_SELECT";
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
  const [optionDrafts, setOptionDrafts] = useState<Record<string, string>>({});

  const groups = useMemo(
    () => fields.filter((field) => field.type === "FIELD_GROUP" && field.parentFieldId === null),
    [fields],
  );

  const rootQuestions = useMemo(
    () => fields.filter((field) => field.type !== "FIELD_GROUP" && field.parentFieldId === null),
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
              Up
            </button>
            <button
              type="button"
              onClick={() => moveField(field.id, "down")}
              className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Down
            </button>
            <button
              type="button"
              onClick={() => removeField(field.id)}
              className="text-sm font-medium text-rose-600 hover:text-rose-700"
            >
              Remove
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm text-slate-700">
            <span>Key</span>
            <input
              type="text"
              value={field.key}
              onChange={(event) => updateField(field.id, { key: event.currentTarget.value })}
              placeholder={isGroup ? "meals_group" : "meal_count"}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="space-y-1 text-sm text-slate-700">
            <span>Label</span>
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
          <span>Description (optional)</span>
          <input
            type="text"
            value={field.description}
            onChange={(event) => updateField(field.id, { description: event.currentTarget.value })}
            placeholder="Shown to clubs before they submit registration"
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm text-slate-700">
            <span>Type</span>
            <select
              value={field.type}
              onChange={(event) => {
                const nextType = event.currentTarget.value as SupportedFormFieldType;
                updateField(field.id, {
                  type: nextType,
                  options: typeAllowsOptions(nextType) ? field.options : [],
                  isRequired: nextType === "FIELD_GROUP" ? false : field.isRequired,
                });
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              disabled={field.parentFieldId !== null}
            >
              <option value="SHORT_TEXT">SHORT_TEXT</option>
              <option value="LONG_TEXT">LONG_TEXT</option>
              <option value="DATE">DATE</option>
              <option value="SINGLE_SELECT">SINGLE_SELECT</option>
              <option value="NUMBER">NUMBER</option>
              <option value="MULTI_SELECT">MULTI_SELECT</option>
              <option value="BOOLEAN">BOOLEAN</option>
              <option value="ROSTER_SELECT">ROSTER_SELECT</option>
              <option value="ROSTER_MULTI_SELECT">ROSTER_MULTI_SELECT</option>
              {field.parentFieldId === null ? <option value="FIELD_GROUP">FIELD_GROUP</option> : null}
            </select>
          </label>

          <label className="flex items-center gap-2 self-end rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={field.isRequired}
              disabled={isGroup}
              onChange={(event) => updateField(field.id, { isRequired: event.currentTarget.checked })}
            />
            Required
          </label>
        </div>

        {typeAllowsOptions(field.type) ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Options</p>
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
                placeholder="Add option"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => addOption(field)}
                className="rounded-lg border border-indigo-300 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
              >
                Add
              </button>
            </div>

            {field.options.length === 0 ? (
              <p className="text-xs text-slate-500">Add at least one option for this question.</p>
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

        {isGroup ? (
          <button
            type="button"
            onClick={() => addChildField(field.id)}
            className="rounded-lg border border-indigo-300 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
          >
            Add Child Field
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
          <h3 className="text-lg font-semibold text-slate-900">Dynamic Registration Questions</h3>
          <p className="text-sm text-slate-600">
            Create top-level questions or grouped questions with nested child fields.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={addTopLevelQuestion}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Add Question
          </button>
          <button
            type="button"
            onClick={addFieldGroup}
            className="rounded-lg border border-indigo-300 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
          >
            Add Field Group
          </button>
        </div>
      </div>

      {!hasFields ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
          No dynamic fields added yet.
        </div>
      ) : null}

      {rootQuestions.map((field, index) => renderFieldCard(field, `Question ${index + 1}`))}

      {groups.map((group, index) => {
        const children = fields.filter((field) => field.parentFieldId === group.id);

        return (
          <div
            key={group.id}
            className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/40 p-3"
          >
            {renderFieldCard(group, `Field Group ${index + 1}`)}
            <div className="space-y-3 pl-0 md:pl-4">
              {children.length === 0 ? (
                <p className="rounded-lg border border-dashed border-indigo-200 bg-white p-3 text-xs text-slate-500">
                  Add child fields to this group.
                </p>
              ) : (
                children.map((child, childIndex) =>
                  renderFieldCard(child, `Child ${childIndex + 1}`),
                )
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
