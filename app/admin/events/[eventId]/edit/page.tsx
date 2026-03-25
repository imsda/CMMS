import Link from "next/link";
import { notFound } from "next/navigation";
import { readEventFieldConfig } from "../../../../../lib/event-form-config";
import { getEventModeConfig } from "../../../../../lib/event-modes";
import { prisma } from "../../../../../lib/prisma";
import { AdminPageHeader } from "../../../_components/admin-page-header";
import { type DynamicFieldDraft } from "../../new/_components/dynamic-form-builder";
import { EventDynamicFieldsEditor } from "./_components/event-dynamic-fields-editor";
import { EventEditForm } from "./_components/event-edit-form";

type EditEventPageProps = {
  params: Promise<{
    eventId: string;
  }>;
};

function toDatetimeLocalValue(date: Date) {
  return date.toISOString().slice(0, 16);
}

export default async function EditEventPage({ params }: EditEventPageProps) {
  const { eventId } = await params;

  const event = await prisma.event.findUnique({
    where: {
      id: eventId,
    },
    select: {
      id: true,
      name: true,
      eventMode: true,
      description: true,
      startsAt: true,
      endsAt: true,
      registrationOpensAt: true,
      registrationClosesAt: true,
      basePrice: true,
      lateFeePrice: true,
      lateFeeStartsAt: true,
      locationName: true,
      locationAddress: true,
      minAttendeeAge: true,
      maxAttendeeAge: true,
      allowedClubTypes: true,
      dynamicFields: {
        select: {
          id: true,
          parentFieldId: true,
          key: true,
          label: true,
          description: true,
          type: true,
          fieldScope: true,
          isRequired: true,
          options: true,
          sortOrder: true,
        },
        orderBy: {
          sortOrder: "asc",
        },
      },
    },
  });

  if (!event) {
    notFound();
  }

  const initialDynamicFields: DynamicFieldDraft[] = event.dynamicFields.map((field) => {
    const config = readEventFieldConfig(field.options);

    return {
      id: field.id,
      parentFieldId: field.parentFieldId,
      key: field.key,
      label: field.label,
      description: field.description ?? "",
      type: field.type,
      fieldScope: field.fieldScope,
      isRequired: field.isRequired,
      options: config.optionValues,
      conditionalFieldKey: config.conditional?.fieldKey ?? "",
      conditionalOperator: config.conditional?.operator ?? "",
      conditionalValue: config.conditional?.value ?? "",
    };
  });

  const hasResponses = await prisma.eventFormResponse.count({
    where: {
      field: {
        eventId: event.id,
      },
    },
  });

  return (
    <section className="space-y-6">
      <AdminPageHeader
        eyebrow="Event Management"
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Events", href: "/admin/events" },
          { label: event.name, href: `/admin/events/${event.id}` },
          { label: "Edit" },
        ]}
        title="Edit Event"
        description={`Update core details for ${event.name}.`}
        secondaryActions={
          <>
            <Link href={`/admin/events/${event.id}`} className="btn-secondary">
              Back to Overseer
            </Link>
            <Link href="/admin/events" className="btn-secondary">
              Back to Events
            </Link>
          </>
        }
      />

      <EventEditForm
        defaults={{
          id: event.id,
          eventModeLabel: getEventModeConfig(event.eventMode).label,
          eventModeDescription: getEventModeConfig(event.eventMode).description,
          name: event.name,
          description: event.description ?? "",
          startsAt: toDatetimeLocalValue(event.startsAt),
          endsAt: toDatetimeLocalValue(event.endsAt),
          registrationOpensAt: toDatetimeLocalValue(event.registrationOpensAt),
          registrationClosesAt: toDatetimeLocalValue(event.registrationClosesAt),
          basePrice: event.basePrice,
          lateFeePrice: event.lateFeePrice,
          lateFeeStartsAt: toDatetimeLocalValue(event.lateFeeStartsAt),
          locationName: event.locationName ?? "",
          locationAddress: event.locationAddress ?? "",
          minAttendeeAge: event.minAttendeeAge,
          maxAttendeeAge: event.maxAttendeeAge,
          allowedClubTypes: event.allowedClubTypes,
        }}
      />

      <EventDynamicFieldsEditor
        eventId={event.id}
        eventMode={event.eventMode}
        eventModeLabel={getEventModeConfig(event.eventMode).label}
        eventModeDescription={getEventModeConfig(event.eventMode).description}
        initialFields={initialDynamicFields}
        hasResponses={hasResponses > 0}
      />
    </section>
  );
}
