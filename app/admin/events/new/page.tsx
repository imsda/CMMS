"use client";

import { useMemo, useState } from "react";

import { createEventWithDynamicFields } from "../../../actions/event-admin-actions";
import {
  DynamicFormBuilder,
  type DynamicFieldDraft,
} from "./_components/dynamic-form-builder";

const STEPS = [
  {
    title: "Event Basics",
    description: "Set event name and start/end dates.",
  },
  {
    title: "Registration & Location",
    description: "Configure registration windows, pricing, and location details.",
  },
  {
    title: "Dynamic Questions",
    description: "Add optional custom form questions for event registrations.",
  },
] as const;

export default function AdminCreateEventPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [dynamicFields, setDynamicFields] = useState<DynamicFieldDraft[]>([]);

  const serializedFields = useMemo(() => JSON.stringify(dynamicFields), [dynamicFields]);

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-slate-500">Super Admin</p>
        <h1 className="text-3xl font-semibold text-slate-900">Create Event</h1>
        <p className="mt-1 text-sm text-slate-600">
          Build a new event in steps, then define dynamic registration questions.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <ol className="grid gap-3 md:grid-cols-3">
          {STEPS.map((step, index) => {
            const isActive = index === currentStep;
            const isComplete = index < currentStep;

            return (
              <li
                key={step.title}
                className={`rounded-xl border p-3 ${
                  isActive
                    ? "border-indigo-300 bg-indigo-50"
                    : isComplete
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-slate-200 bg-slate-50"
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Step {index + 1}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{step.title}</p>
                <p className="mt-1 text-xs text-slate-600">{step.description}</p>
              </li>
            );
          })}
        </ol>
      </div>

      <form action={createEventWithDynamicFields} className="space-y-6">
        <input type="hidden" name="dynamicFieldsJson" value={serializedFields} readOnly />

        {currentStep === 0 ? (
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Event Basics</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
                <span>Event Name</span>
                <input
                  name="name"
                  type="text"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="2027 Conference Camporee"
                />
              </label>

              <label className="space-y-1 text-sm text-slate-700">
                <span>Starts At</span>
                <input
                  name="startsAt"
                  type="datetime-local"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>

              <label className="space-y-1 text-sm text-slate-700">
                <span>Ends At</span>
                <input
                  name="endsAt"
                  type="datetime-local"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
            </div>
          </div>
        ) : null}

        {currentStep === 1 ? (
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Registration & Location</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm text-slate-700">
                <span>Registration Opens</span>
                <input
                  name="registrationOpensAt"
                  type="datetime-local"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>

              <label className="space-y-1 text-sm text-slate-700">
                <span>Registration Closes</span>
                <input
                  name="registrationClosesAt"
                  type="datetime-local"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>

              <label className="space-y-1 text-sm text-slate-700">
                <span>Base Price (per attendee)</span>
                <input
                  name="basePrice"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="35.00"
                />
              </label>

              <label className="space-y-1 text-sm text-slate-700">
                <span>Late Fee Price (per attendee)</span>
                <input
                  name="lateFeePrice"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="50.00"
                />
              </label>

              <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
                <span>Late Fee Starts At</span>
                <input
                  name="lateFeeStartsAt"
                  type="datetime-local"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>

              <label className="space-y-1 text-sm text-slate-700">
                <span>Location Name</span>
                <input
                  name="locationName"
                  type="text"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="Indian Creek Camp"
                />
              </label>

              <label className="space-y-1 text-sm text-slate-700">
                <span>Location Address</span>
                <input
                  name="locationAddress"
                  type="text"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="1234 Camp Rd, City, ST"
                />
              </label>
            </div>
          </div>
        ) : null}

        {currentStep === 2 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <DynamicFormBuilder fields={dynamicFields} onChange={setDynamicFields} />
          </div>
        ) : null}

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setCurrentStep((step) => Math.max(0, step - 1))}
            disabled={currentStep === 0}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Back
          </button>

          {currentStep < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setCurrentStep((step) => Math.min(STEPS.length - 1, step + 1))}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Continue
            </button>
          ) : (
            <button
              type="submit"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              Create Event
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
