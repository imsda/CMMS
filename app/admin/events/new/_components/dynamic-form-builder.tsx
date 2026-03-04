"use client";

import { useMemo, useState } from "react";

export type SupportedFormFieldType =
  | "SHORT_TEXT"
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
  optionsJson: string;
};

type DynamicFormBuilderProps = {
  fields: DynamicFieldDraft[];
  onChange: (fields: DynamicFieldDraft[]) => void;
};

const DEFAULT_TYPE: SupportedFormFieldType = "SHORT_TEXT";

function createEmptyField(parentFieldId: string | null = null, type: SupportedFormFieldType = DEFAULT_TYPE): DynamicFieldDraft {
  return {
    id: crypto.randomUUID(),
    parentFieldId,
    key: "",
    label: "",
    description: "",
    type,
    isRequired: false,
    optionsJson: "[]",
  };
}

function typeAllowsOptions(type: SupportedFormFieldType) {
  return type === "MULTI_SELECT";
}

export function DynamicFormBuilder({ fields, onChange }: DynamicFormBuilderProps) {
  const [jsonErrors, setJsonErrors] = useState<Record<string, string>>({});

  const groups = useMemo(
    () => fields.filter((field) => field.type === "FIELD_GROUP" && field.parentFieldId === null),
    [fields],
  );
  const rootQuestions = useMemo(
    () => fields.filter((field) => field.type !== "FIELD_GROUP" && field.parentFieldId === null),
    [fields],
  );

  const hasFields = fields.length > 0;

  const parsedPreview = useMemo(() => {
    return fields.reduce<Record<string, string[]>>((accumulator, field) => {
      if (!typeAllowsOptions(field.type)) {
        return accumulator;
      }

      try {
        const parsed = JSON.parse(field.optionsJson);
        if (
          Array.isArray(parsed) &&
          parsed.every((option) => typeof option === "string" && option.trim().length > 0)
        ) {
          accumulator[field.id] = parsed;
        }
      } catch {
        // Ignored. surfaced in jsonErrors state.
      }

      return accumulator;
    }, {});
  }, [fields]);

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
    const childIds = new Set(fields.filter((field) => field.parentFieldId === id).map((field) => field.id));
    onChange(fields.filter((field) => field.id !== id && !childIds.has(field.id)));
    setJsonErrors((current) => {
      const next = { ...current };
      delete next[id];
      for (const childId of childIds) {
        delete next[childId];
      }
      return next;
    });
  }

  function validateJson(fieldId: string, value: string) {
    try {
      const parsed = JSON.parse(value);

      if (
        !Array.isArray(parsed) ||
        !parsed.every((option) => typeof option === "string" && option.trim().length > 0)
      ) {
        setJsonErrors((current) => ({
          ...current,
          [fieldId]: "Options must be a JSON array of non-empty strings.",
        }));
        return;
      }

      setJsonErrors((current) => {
        const next = { ...current };
        delete next[fieldId];
        return next;
      });
    } catch {
      setJsonErrors((current) => ({
        ...current,
        [fieldId]: "Invalid JSON. Example: [\"Breakfast\", \"Supper\"]",
      }));
    }
  }

  function renderFieldCard(field: DynamicFieldDraft, indexLabel: string) {
    const isGroup = field.type === "FIELD_GROUP";

    return (
      <article key={field.id} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-900">{indexLabel}</h4>
          <button
            type="button"
            onClick={() => removeField(field.id)}
            className="text-sm font-medium text-rose-600 hover:text-rose-700"
          >
            Remove
          </button>
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
              onChange={(event) => updateField(field.id, { label: event.currentTarget.value })}
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
                  optionsJson: typeAllowsOptions(nextType) ? field.optionsJson || "[]" : "[]",
                  isRequired: nextType === "FIELD_GROUP" ? false : field.isRequired,
                });
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              disabled={field.parentFieldId !== null}
            >
              <option value="SHORT_TEXT">SHORT_TEXT</option>
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
            <label className="block space-y-1 text-sm text-slate-700">
              <span>Options JSON</span>
              <textarea
                value={field.optionsJson}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  updateField(field.id, { optionsJson: value });
                  validateJson(field.id, value);
                }}
                rows={3}
                placeholder='["Breakfast", "Lunch", "Supper"]'
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
              />
            </label>
            {jsonErrors[field.id] ? <p className="text-xs font-medium text-rose-600">{jsonErrors[field.id]}</p> : null}
            {parsedPreview[field.id] ? (
              <p className="text-xs text-slate-500">Preview: {parsedPreview[field.id].join(" • ")}</p>
            ) : null}
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Dynamic Registration Questions</h3>
          <p className="text-sm text-slate-600">Create top-level questions or grouped questions with nested child fields.</p>
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
          <div key={group.id} className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/40 p-3">
            {renderFieldCard(group, `Field Group ${index + 1}`)}
            <div className="space-y-3 pl-0 md:pl-4">
              {children.length === 0 ? (
                <p className="rounded-lg border border-dashed border-indigo-200 bg-white p-3 text-xs text-slate-500">
                  Add child fields to this group.
                </p>
              ) : (
                children.map((child, childIndex) => renderFieldCard(child, `Child ${childIndex + 1}`))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
