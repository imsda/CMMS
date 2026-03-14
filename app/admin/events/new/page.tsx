import { prisma } from "../../../../lib/prisma";
import { serializeEventTemplateDraft } from "../../../../lib/event-templates";
import { AdminCreateEventClient } from "./_components/admin-create-event-client";

export default async function AdminCreateEventPage({
  searchParams,
}: {
  searchParams?: Promise<{ created?: string; template?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const selectedTemplateId = resolvedSearchParams?.template ?? null;
  const created = resolvedSearchParams?.created === "1";

  const templates = await prisma.eventTemplate.findMany({
    where: {
      archivedAt: null,
      isActive: true,
    },
    orderBy: [{ source: "asc" }, { updatedAt: "desc" }],
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

  return (
    <AdminCreateEventClient
      created={created}
      selectedTemplateId={selectedTemplateId}
      templates={templates.map(serializeEventTemplateDraft)}
    />
  );
}
