import Link from "next/link";
import { TltApplicationStatus } from "@prisma/client";

import { getManagedClubContext } from "../../../../../lib/club-management";
import { buildDirectorPath } from "../../../../../lib/director-path";
import { saveTltApplication } from "../../../../actions/tlt-actions";
import { prisma } from "../../../../../lib/prisma";

const classOptions = ["Friend", "Companion", "Explorer", "Ranger", "Voyager", "Guide"];
const shirtSizes = ["XS", "S", "M", "L", "XL", "2XL", "3XL"];

export default async function TltApplicationPage({
  params,
  searchParams,
}: {
  params: Promise<{ memberId: string }>;
  searchParams?: Promise<{ clubId?: string }>;
}) {
  const { memberId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const managedClub = await getManagedClubContext(resolvedSearchParams?.clubId ?? null);

  const club = await prisma.club.findUnique({
    where: {
      id: managedClub.clubId,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!club) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <h1 className="text-xl font-semibold">Club not found</h1>
        <p className="mt-2 text-sm">You need a valid club before submitting TLT applications.</p>
      </section>
    );
  }

  const member = await prisma.rosterMember.findFirst({
    where: {
      id: memberId,
      memberRole: "TLT",
      clubRosterYear: {
        clubId: club.id,
      },
    },
    include: {
      tltApplication: true,
      clubRosterYear: {
        select: {
          yearLabel: true,
        },
      },
    },
  });

  if (!member) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <h1 className="text-xl font-semibold">TLT member not found</h1>
        <p className="mt-2 text-sm">The selected member is not a TLT in your club roster.</p>
        <Link
          href={buildDirectorPath("/director/tlt", club.id, managedClub.isSuperAdmin)}
          className="mt-4 inline-flex rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white"
        >
          Back to TLT Dashboard
        </Link>
      </section>
    );
  }

  const existingApplication = member.tltApplication;
  const selectedClasses = Array.isArray(existingApplication?.classesCompleted)
    ? (existingApplication?.classesCompleted as string[])
    : [];

  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm font-medium text-slate-500">Teen Leadership Training</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">TLT Application Form</h1>
        <p className="mt-1 text-sm text-slate-600">
          {member.firstName} {member.lastName} • {club.name} • Roster {member.clubRosterYear.yearLabel}
        </p>
      </header>

      <form action={saveTltApplication} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2">
        <input type="hidden" name="rosterMemberId" value={member.id} />
        {managedClub.isSuperAdmin ? <input type="hidden" name="clubId" value={club.id} /> : null}

        <label className="space-y-1 text-sm font-medium text-slate-700">
          <span>Grade</span>
          <input
            type="number"
            name="grade"
            min={5}
            max={12}
            required
            defaultValue={existingApplication?.grade ?? ""}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
          />
        </label>

        <label className="space-y-1 text-sm font-medium text-slate-700">
          <span>Citizenship</span>
          <input
            type="text"
            name="citizenship"
            required
            defaultValue={existingApplication?.citizenship ?? ""}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
          />
        </label>

        <label className="space-y-1 text-sm font-medium text-slate-700">
          <span>TLT Year Working On</span>
          <input
            type="number"
            name="tltYearWorkingOn"
            min={1}
            max={4}
            required
            defaultValue={existingApplication?.tltYearWorkingOn ?? 1}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
          />
        </label>

        <label className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            name="isBaptized"
            defaultChecked={existingApplication?.isBaptized ?? false}
            className="h-4 w-4 rounded border-slate-300"
          />
          Baptized
        </label>

        <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2">
          <span>School Name</span>
          <input
            type="text"
            name="schoolName"
            required
            defaultValue={existingApplication?.schoolName ?? ""}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
          />
        </label>

        <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2">
          <span>School Address</span>
          <textarea
            name="schoolAddress"
            rows={3}
            required
            defaultValue={existingApplication?.schoolAddress ?? ""}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
          />
        </label>

        <fieldset className="space-y-2 md:col-span-2">
          <legend className="text-sm font-semibold text-slate-900">Classes Completed</legend>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {classOptions.map((className) => (
              <label key={className} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="classesCompleted"
                  value={className}
                  defaultChecked={selectedClasses.includes(className)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                {className}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="space-y-1 text-sm font-medium text-slate-700">
          <span>T-Shirt Size</span>
          <select
            name="tShirtSize"
            required
            defaultValue={existingApplication?.tShirtSize ?? ""}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
          >
            <option value="" disabled>
              Select a size
            </option>
            {shirtSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm font-medium text-slate-700">
          <span>Polo Size</span>
          <select
            name="poloSize"
            required
            defaultValue={existingApplication?.poloSize ?? ""}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
          >
            <option value="" disabled>
              Select a size
            </option>
            {shirtSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2">
          <span>Application Status</span>
          <select
            name="status"
            required
            defaultValue={existingApplication?.status ?? TltApplicationStatus.PENDING}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
          >
            {Object.values(TltApplicationStatus).map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-3 md:col-span-2">
          <button type="submit" className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500">
            Save TLT Application
          </button>
          <Link href={buildDirectorPath("/director/tlt", club.id, managedClub.isSuperAdmin)} className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700">
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}
