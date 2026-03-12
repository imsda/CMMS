"use client";

import { useFormState } from "react-dom";

import { updateEventInitialState } from "../../../../../actions/event-admin-state";
import {
  updateEventCoreDetails,
} from "../../../../../actions/event-admin-actions";

type EventEditDefaults = {
  id: string;
  name: string;
  description: string;
  startsAt: string;
  endsAt: string;
  registrationOpensAt: string;
  registrationClosesAt: string;
  basePrice: number;
  lateFeePrice: number;
  lateFeeStartsAt: string;
  locationName: string;
  locationAddress: string;
};

type EventEditFormProps = {
  defaults: EventEditDefaults;
};

export function EventEditForm({ defaults }: EventEditFormProps) {
  const [state, formAction] = useFormState(updateEventCoreDetails, updateEventInitialState);

  return (
    <form action={formAction} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <input type="hidden" name="eventId" value={defaults.id} readOnly />

      <div>
        <h2 className="text-xl font-semibold text-slate-900">Edit Event Details</h2>
        <p className="mt-1 text-sm text-slate-600">Update timeline, registration window, and pricing details.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
          <span>Event Name</span>
          <input
            name="name"
            type="text"
            required
            defaultValue={defaults.name}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
          <span>Description (optional)</span>
          <textarea
            name="description"
            defaultValue={defaults.description}
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="space-y-1 text-sm text-slate-700">
          <span>Starts At</span>
          <input
            name="startsAt"
            type="datetime-local"
            required
            defaultValue={defaults.startsAt}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="space-y-1 text-sm text-slate-700">
          <span>Ends At</span>
          <input
            name="endsAt"
            type="datetime-local"
            required
            defaultValue={defaults.endsAt}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="space-y-1 text-sm text-slate-700">
          <span>Registration Opens</span>
          <input
            name="registrationOpensAt"
            type="datetime-local"
            required
            defaultValue={defaults.registrationOpensAt}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="space-y-1 text-sm text-slate-700">
          <span>Registration Closes</span>
          <input
            name="registrationClosesAt"
            type="datetime-local"
            required
            defaultValue={defaults.registrationClosesAt}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="space-y-1 text-sm text-slate-700">
          <span>Base Price</span>
          <input
            name="basePrice"
            type="number"
            min="0"
            step="0.01"
            required
            defaultValue={defaults.basePrice}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="space-y-1 text-sm text-slate-700">
          <span>Late Fee Price</span>
          <input
            name="lateFeePrice"
            type="number"
            min="0"
            step="0.01"
            required
            defaultValue={defaults.lateFeePrice}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
          <span>Late Fee Starts At</span>
          <input
            name="lateFeeStartsAt"
            type="datetime-local"
            required
            defaultValue={defaults.lateFeeStartsAt}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="space-y-1 text-sm text-slate-700">
          <span>Location Name</span>
          <input
            name="locationName"
            type="text"
            defaultValue={defaults.locationName}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="space-y-1 text-sm text-slate-700">
          <span>Location Address</span>
          <input
            name="locationAddress"
            type="text"
            defaultValue={defaults.locationAddress}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
      </div>

      {state.status === "error" && state.message ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {state.message}
        </p>
      ) : null}

      {state.status === "success" && state.message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
      >
        Save Event Changes
      </button>
    </form>
  );
}
