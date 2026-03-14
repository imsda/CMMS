import { notFound } from "next/navigation";

import { AdminPageHeader } from "../../../_components/admin-page-header";
import { EventTemplateEditor } from "../_components/event-template-editor";
import { prisma } from "../../../../../lib/prisma";
import { serializeEventTemplateDraft } from "../../../../../lib/event-templates";

type EventTemplatePageProps = {
  params: Promise<{ templateId: string }>;
};

export default async function EventTemplatePage({ params }: EventTemplatePageProps) {
  const { templateId } = await params;

  const template = await prisma.eventTemplate.findUnique({
    where: {
      id: templateId,
    },
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

  if (!template) {
    notFound();
  }

  const draft = serializeEventTemplateDraft(template);

  return (
    <section className="space-y-6">
      <AdminPageHeader
        eyebrow="Events"
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Events", href: "/admin/events" },
          { label: "Templates", href: "/admin/events/templates" },
          { label: draft.name },
        ]}
        title={draft.name}
        description={draft.description || "Review and maintain this template."}
      />

      <EventTemplateEditor template={draft} />
    </section>
  );
}
