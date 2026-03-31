"use client";

import { useState } from "react";

type Requirement = {
  requirementType: string;
  minAge: number | null;
  maxAge: number | null;
  requiredMemberRole: string | null;
  requiredHonorCode: string | null;
  requiredMasterGuide: boolean | null;
};

type CatalogItem = {
  id: string;
  title: string;
  code: string;
  description: string | null;
  classType: string;
  requirements: Requirement[];
  upcomingEvents: string[];
};

type ClassTypeFilter = "ALL" | "HONOR" | "SPECIALTY" | "WORKSHOP";

type CatalogSearchClientProps = {
  items: CatalogItem[];
};

function requirementBadge(req: Requirement): string {
  if (req.requirementType === "MIN_AGE" && req.minAge !== null) {
    return `Age ≥ ${req.minAge}`;
  }
  if (req.requirementType === "MAX_AGE" && req.maxAge !== null) {
    return `Age ≤ ${req.maxAge}`;
  }
  if (req.requirementType === "MEMBER_ROLE" && req.requiredMemberRole) {
    return `Role: ${req.requiredMemberRole.replace(/_/g, " ")}`;
  }
  if (req.requirementType === "COMPLETED_HONOR" && req.requiredHonorCode) {
    return `Prereq: ${req.requiredHonorCode}`;
  }
  if (req.requirementType === "MASTER_GUIDE") {
    return "Master Guide required";
  }
  return req.requirementType;
}

function classTypeLabel(type: string) {
  const labels: Record<string, string> = {
    HONOR: "Honor",
    SPECIALTY: "Specialty",
    WORKSHOP: "Workshop",
    REQUIRED: "Required",
  };
  return labels[type] ?? type;
}

function classTypeBadgeClass(type: string) {
  const classes: Record<string, string> = {
    HONOR: "bg-indigo-100 text-indigo-700",
    SPECIALTY: "bg-violet-100 text-violet-700",
    WORKSHOP: "bg-amber-100 text-amber-700",
    REQUIRED: "bg-rose-100 text-rose-700",
  };
  return classes[type] ?? "bg-slate-100 text-slate-700";
}

export function CatalogSearchClient({ items }: CatalogSearchClientProps) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ClassTypeFilter>("ALL");

  const filtered = items.filter((item) => {
    if (typeFilter !== "ALL" && item.classType !== typeFilter) {
      return false;
    }
    if (search.trim().length > 0) {
      const q = search.trim().toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        (item.description?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search by title, code, or description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap gap-2">
          {(["ALL", "HONOR", "SPECIALTY", "WORKSHOP"] as ClassTypeFilter[]).map(
            (type) => (
              <button
                key={type}
                type="button"
                onClick={() => setTypeFilter(type)}
                className={`rounded-full px-4 py-1 text-sm font-semibold transition-colors ${
                  typeFilter === type
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {type === "ALL" ? "All Types" : classTypeLabel(type)}
              </button>
            ),
          )}
        </div>
      </div>

      <p className="text-sm text-slate-500">
        {filtered.length === 0
          ? "No catalog entries match your search."
          : `Showing ${filtered.length} of ${items.length} entries`}
      </p>

      {/* Catalog entries */}
      <div className="grid gap-4">
        {filtered.map((item) => (
          <article
            key={item.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${classTypeBadgeClass(item.classType)}`}
                  >
                    {classTypeLabel(item.classType)}
                  </span>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">
                    {item.code}
                  </span>
                </div>
                <h3 className="mt-1.5 text-base font-semibold text-slate-900">
                  {item.title}
                </h3>
                {item.description ? (
                  <p className="mt-1 text-sm text-slate-600">{item.description}</p>
                ) : null}
              </div>
            </div>

            {/* Prerequisites */}
            {item.requirements.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {item.requirements.map((req, i) => (
                  <span
                    key={i}
                    className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800"
                  >
                    {requirementBadge(req)}
                  </span>
                ))}
              </div>
            ) : null}

            {/* Upcoming events */}
            {item.upcomingEvents.length > 0 ? (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Offered at upcoming events
                </p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {item.upcomingEvents.map((eventName) => (
                    <span
                      key={eventName}
                      className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
                    >
                      {eventName}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
