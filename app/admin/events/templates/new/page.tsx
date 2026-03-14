import { AdminPageHeader } from "../../../_components/admin-page-header";
import { EventTemplateEditor } from "../_components/event-template-editor";

export default function NewEventTemplatePage() {
  return (
    <section className="space-y-6">
      <AdminPageHeader
        eyebrow="Events"
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Events", href: "/admin/events" },
          { label: "Templates", href: "/admin/events/templates" },
          { label: "New Template" },
        ]}
        title="Create Template"
        description="Build a reusable event template with a fixed mode, defaults, and question set."
      />

      <EventTemplateEditor template={null} />
    </section>
  );
}
