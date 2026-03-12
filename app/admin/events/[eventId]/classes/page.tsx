import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";

import {
  clearEventClassOfferingEnrollmentsAction,
  createEventClassOfferingAction,
  removeEventClassOfferingAction,
  updateEventClassOfferingAction,
} from "../../../../actions/admin-actions";
import { CLASS_ASSIGNMENT_POLICY } from "../../../../../lib/class-model";
import { prisma } from "../../../../../lib/prisma";

type AdminEventClassesPageProps = {
  params: Promise<{
    eventId: string;
  }>;
  searchParams?: Promise<{
    actionStatus?: string;
    actionMessage?: string;
  }>;
};

export default async function AdminEventClassesPage({
  params,
  searchParams,
}: AdminEventClassesPageProps) {
  const { eventId } = await params;
  const resolvedSearchParams = await searchParams;
  const actionStatus = resolvedSearchParams?.actionStatus;
  const actionMessage = resolvedSearchParams?.actionMessage;

  const [event, catalogItems, teachers] = await Promise.all([
    prisma.event.findUnique({
      where: {
        id: eventId,
      },
      select: {
        id: true,
        name: true,
        classOfferings: {
          include: {
            enrollments: {
              select: {
                attendedAt: true,
              },
            },
            classCatalog: {
              select: {
                id: true,
                title: true,
                code: true,
                classType: true,
              },
            },
            teacher: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            _count: {
              select: {
                enrollments: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    }),
    prisma.classCatalog.findMany({
      where: {
        active: true,
      },
      select: {
        id: true,
        title: true,
        code: true,
        classType: true,
      },
      orderBy: {
        title: "asc",
      },
    }),
    prisma.user.findMany({
      where: {
        role: UserRole.STAFF_TEACHER,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
  ]);

  if (!event) {
    notFound();
  }

  const assignedCatalogIds = new Set(event.classOfferings.map((offering) => offering.classCatalog.id));
  const availableCatalogItems = catalogItems.filter((item) => !assignedCatalogIds.has(item.id));

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Event Management</p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-900">Class Offerings</h1>
        <p className="mt-2 text-sm text-slate-600">
          Configure class offerings, assign teachers, and set capacity for{" "}
          <span className="font-semibold text-slate-900">{event.name}</span>.
        </p>
        <p className="mt-1 text-xs font-medium text-slate-500">{CLASS_ASSIGNMENT_POLICY}</p>
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

      {actionStatus && actionMessage ? (
        <p
          className={`rounded-lg px-4 py-3 text-sm ${
            actionStatus === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {actionMessage}
        </p>
      ) : null}

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Add Class Offering</h2>
        <p className="mt-1 text-sm text-slate-600">
          Add active catalog classes to this event and optionally pre-assign a teacher.
        </p>

        {availableCatalogItems.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">
            All active catalog classes are already assigned to this event.
          </p>
        ) : (
          <form action={createEventClassOfferingAction} className="mt-4 grid gap-4 md:grid-cols-4">
            <input type="hidden" name="eventId" value={event.id} readOnly />

            <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
              <span>Catalog Class</span>
              <select name="classCatalogId" required defaultValue="" className="w-full rounded-lg border border-slate-300 px-3 py-2">
                <option value="" disabled>
                  Select class
                </option>
                {availableCatalogItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title} ({item.code}) • {item.classType}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm text-slate-700">
              <span>Teacher (optional)</span>
              <select name="teacherUserId" defaultValue="" className="w-full rounded-lg border border-slate-300 px-3 py-2">
                <option value="">Unassigned</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name} ({teacher.email})
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm text-slate-700">
              <span>Capacity (optional)</span>
              <input
                name="capacity"
                type="number"
                min={0}
                step={1}
                placeholder="Open"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>

            <div className="md:col-span-4">
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                Add Offering
              </button>
            </div>
          </form>
        )}
      </article>

      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Current Offerings</h2>
        </div>

        {event.classOfferings.length === 0 ? (
          <p className="px-6 py-5 text-sm text-slate-600">No class offerings configured yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Class</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Teacher</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Capacity</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Enrolled</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Attendance</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {event.classOfferings.map((offering) => {
                  const attendedCount = offering.enrollments.filter(
                    (enrollment) => enrollment.attendedAt !== null,
                  ).length;

                  return (
                    <tr key={offering.id}>
                      <td className="px-4 py-3 text-slate-900">
                        <p className="font-semibold">{offering.classCatalog.title}</p>
                        <p className="text-xs text-slate-500">
                          {offering.classCatalog.code} • {offering.classCatalog.classType}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <form action={updateEventClassOfferingAction} className="space-y-2">
                          <input type="hidden" name="eventId" value={event.id} readOnly />
                          <input type="hidden" name="offeringId" value={offering.id} readOnly />
                          <select
                            name="teacherUserId"
                            defaultValue={offering.teacher?.id ?? ""}
                            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                          >
                            <option value="">Unassigned</option>
                            {teachers.map((teacher) => (
                              <option key={teacher.id} value={teacher.id}>
                                {teacher.name} ({teacher.email})
                              </option>
                            ))}
                          </select>
                          <button
                            type="submit"
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700"
                          >
                            Save Teacher
                          </button>
                        </form>
                      </td>
                      <td className="px-4 py-3">
                        <form action={updateEventClassOfferingAction} className="flex items-center gap-2">
                          <input type="hidden" name="eventId" value={event.id} readOnly />
                          <input type="hidden" name="offeringId" value={offering.id} readOnly />
                          <input
                            name="capacity"
                            type="number"
                            min={offering._count.enrollments}
                            step={1}
                            defaultValue={offering.capacity ?? ""}
                            placeholder="Open"
                            className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                          />
                          <button
                            type="submit"
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700"
                          >
                            Save
                          </button>
                          <span className="text-[11px] text-slate-500">
                            Min {offering._count.enrollments}
                          </span>
                        </form>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{offering._count.enrollments}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {attendedCount}/{offering._count.enrollments}
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-2">
                          <form action={removeEventClassOfferingAction}>
                            <input type="hidden" name="eventId" value={event.id} readOnly />
                            <input type="hidden" name="offeringId" value={offering.id} readOnly />
                            <button
                              type="submit"
                              disabled={offering._count.enrollments > 0}
                              className="rounded-md border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Remove
                            </button>
                          </form>

                          {offering._count.enrollments > 0 ? (
                            <form action={clearEventClassOfferingEnrollmentsAction} className="space-y-1">
                              <input type="hidden" name="eventId" value={event.id} readOnly />
                              <input type="hidden" name="offeringId" value={offering.id} readOnly />
                              <button
                                type="submit"
                                className="rounded-md border border-amber-300 px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-50"
                              >
                                Clear Enrollments
                              </button>
                              <p className="text-[11px] text-slate-500">Required before removal</p>
                            </form>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}
