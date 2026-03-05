import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "../../../../../lib/prisma";
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
    },
  });

  if (!event) {
    notFound();
  }

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Event Management</p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-900">Edit Event</h1>
        <p className="mt-2 text-sm text-slate-600">
          Update core details for <span className="font-semibold text-slate-900">{event.name}</span>.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/admin/events/${event.id}`}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700"
          >
            Back to Overseer
          </Link>
          <Link
            href="/admin/events"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700"
          >
            Back to Events
          </Link>
        </div>
      </header>

      <EventEditForm
        defaults={{
          id: event.id,
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
        }}
      />
    </section>
  );
}
