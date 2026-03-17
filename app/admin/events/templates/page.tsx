import Link from "next/link";
import { EventTemplateSource } from "@prisma/client";

import {
  duplicateEventTemplate,
} from "../../../actions/event-admin-actions";
import { ArchiveTemplateButton } from "./_components/archive-template-button";
import { AdminPageHeader } from "../../_components/admin-page-header";
import { prisma } from "../../../../lib/prisma";
import { serializeEventTemplateDraft } from "../../../../lib/event-templates";
import {
  getTemplateCoverageSummary,
  getTemplateCategoryLabel,
  getTemplateLibraryFilters,
  getTemplateSectionSummaries,
  getTemplateSourceLabel,
  matchesTemplateFilter,
  type TemplateLibraryFilter,
} from "../../../../lib/template-library";
import { getEventModeConfig } from "../../../../lib/event-modes";

export default async function EventTemplatesLibraryPage({
  searchParams,
}: {
  searchParams?: Promise<{ filter?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const filter = (resolvedSearchParams?.filter ?? "ALL") as TemplateLibraryFilter;

  const templates = await prisma.eventTemplate.findMany({
    where: {
      archivedAt: null,
    },
    orderBy: [{ source: "asc" }, { category: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      templateKey: true,
      name: true,
      description: true,
      eventMode: true,
      category: true,
      source: true,
      isActive: true,
      archivedAt: true,
      snapshot: true,
      updatedAt: true,
    },
  });

  const drafts = templates.map(serializeEventTemplateDraft);
  const visibleTemplates = drafts.filter((template) => matchesTemplateFilter(filter, template));

  return (
    <section className="space-y-6">
      <AdminPageHeader
        eyebrow="Events"
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Events", href: "/admin/events" },
          { label: "Templates" },
        ]}
        title="Template Library"
        description="Manage official and user-created templates, then launch polished create-event flows from reusable event blueprints."
        primaryAction={
          <Link href="/admin/events/templates/new" className="btn-primary">
            Create Template
          </Link>
        }
        secondaryActions={
          <>
            <Link href="/admin/events/new" className="btn-secondary">
              Create Event
            </Link>
            <Link href="/admin/events" className="btn-secondary">
              Back to Events
            </Link>
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        {getTemplateLibraryFilters().map((option) => (
          <Link
            key={option.value}
            href={option.value === "ALL" ? "/admin/events/templates" : `/admin/events/templates?filter=${option.value}`}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
              filter === option.value
                ? "bg-indigo-600 text-white"
                : "border border-slate-300 text-slate-700 hover:border-slate-400"
            }`}
          >
            {option.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {visibleTemplates.map((template) => {
          const mode = getEventModeConfig(template.eventMode);
          const sections = getTemplateSectionSummaries(template.snapshot);
          const coverage = getTemplateCoverageSummary(template.snapshot);

          return (
            <article key={template.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{template.name}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {template.description || "No description provided."}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    template.source === EventTemplateSource.SYSTEM
                      ? "bg-amber-100 text-amber-800"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {getTemplateSourceLabel(template.source)}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-indigo-100 px-3 py-1 text-indigo-800">{mode.label}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                  {getTemplateCategoryLabel(template.category)}
                </span>
                <span className={`rounded-full px-3 py-1 ${template.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>
                  {template.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              <p className="mt-4 text-sm text-slate-600">{mode.description}</p>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap gap-3 text-xs font-semibold text-slate-600">
                  <span>{coverage.sectionCount} sections</span>
                  <span>{coverage.fieldCount} starter fields</span>
                  <span>{coverage.globalFieldCount} club-level</span>
                  {coverage.attendeeFieldCount > 0 ? <span>{coverage.attendeeFieldCount} attendee-level</span> : null}
                </div>
                {sections.length > 0 ? (
                  <div className="mt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Included Sections</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {sections.map((section) => (
                        <span key={section} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                          {section}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Link href={`/admin/events/new?template=${template.id}`} className="btn-primary">
                  Create Event from Template
                </Link>
                <Link href={`/admin/events/templates/${template.id}`} className="btn-secondary">
                  {template.source === EventTemplateSource.SYSTEM ? "View Template" : "Edit Template"}
                </Link>
                <form action={duplicateEventTemplate}>
                  <input type="hidden" name="templateId" value={template.id} readOnly />
                  <button type="submit" className="btn-secondary">
                    Duplicate
                  </button>
                </form>
                {template.source === EventTemplateSource.USER ? (
                  <ArchiveTemplateButton templateId={template.id} />
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {visibleTemplates.length === 0 ? (
        <article className="empty-state">
          <h2 className="text-lg font-semibold text-slate-900">No templates found</h2>
          <p className="mt-2 text-sm text-slate-600">
            Adjust the filter, create a new user template, or use the official system templates as a starting point.
          </p>
        </article>
      ) : null}
    </section>
  );
}
