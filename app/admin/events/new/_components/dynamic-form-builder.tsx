"use client";

import { useMemo, useState } from "react";

export type SupportedFormFieldType = "SHORT_TEXT" | "MULTI_SELECT" | "BOOLEAN";

export type DynamicFieldDraft = {
  id: string;
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

function createEmptyField(): DynamicFieldDraft {
  return {
    id: crypto.randomUUID(),
    key: "",
    label: "",
    description: "",
    type: DEFAULT_TYPE,
    isRequired: false,
    optionsJson: "[]",
  };
}

export function DynamicFormBuilder({ fields, onChange }: DynamicFormBuilderProps) {
  const [jsonErrors, setJsonErrors] = useState<Record<string, string>>({});

  const hasFields = fields.length > 0;

  const parsedPreview = useMemo(() => {
    return fields.reduce<Record<string, string[]>>((accumulator, field) => {
      if (field.type !== "MULTI_SELECT") {
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
        // Ignored. We surface this in jsonErrors state.
      }

      return accumulator;
    }, {});
  }, [fields]);

  function updateField(id: string, updates: Partial<DynamicFieldDraft>) {
    onChange(fields.map((field) => (field.id === id ? { ...field, ...updates } : field)));
  }

  function addField() {
    onChange([...fields, createEmptyField()]);
  }

  function removeField(id: string) {
    onChange(fields.filter((field) => field.id !== id));
    setJsonErrors((current) => {
      const next = { ...current };
      delete next[id];
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
        [fieldId]: "Invalid JSON. Example: [\"Play Revelry\", \"Lead Singing\"]",
      }));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Dynamic Registration Questions</h3>
          <p className="text-sm text-slate-600">
            Add optional event-specific questions for club registration.
          </p>
        </div>
        <button
          type="button"
          onClick={addField}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Add Question
        </button>
      </div>

      {!hasFields ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
          No dynamic fields added yet.
        </div>
      ) : null}

      {fields.map((field, index) => (
        <article key={field.id} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-900">Question {index + 1}</h4>
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
                placeholder="camp_role"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="space-y-1 text-sm text-slate-700">
              <span>Label</span>
              <input
                type="text"
                value={field.label}
                onChange={(event) => updateField(field.id, { label: event.currentTarget.value })}
                placeholder="What role are you helping with?"
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
                    optionsJson: nextType === "MULTI_SELECT" ? field.optionsJson || "[]" : "[]",
                  });
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                <option value="SHORT_TEXT">SHORT_TEXT</option>
                <option value="MULTI_SELECT">MULTI_SELECT</option>
                <option value="BOOLEAN">BOOLEAN</option>
              </select>
            </label>

            <label className="flex items-center gap-2 self-end rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={field.isRequired}
                onChange={(event) => updateField(field.id, { isRequired: event.currentTarget.checked })}
              />
              Required
            </label>
          </div>

          {field.type === "MULTI_SELECT" ? (
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
                  placeholder='["Play Revelry", "Lead Singing"]'
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
                />
              </label>
              {jsonErrors[field.id] ? (
                <p className="text-xs font-medium text-rose-600">{jsonErrors[field.id]}</p>
              ) : null}
              {parsedPreview[field.id] ? (
                <p className="text-xs text-slate-500">
                  Preview: {parsedPreview[field.id].join(" • ")}
                </p>
              ) : null}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}
