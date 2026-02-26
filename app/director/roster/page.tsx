import { auth } from "../../../auth";
import { executeYearlyRollover } from "../../actions/roster-actions";
import { prisma } from "../../../lib/prisma";
import { RosterTable } from "./_components/roster-table";

const CURRENT_YEAR_LABEL = String(new Date().getFullYear());

export default async function DirectorRosterPage() {
  const session = await auth();

  if (!session?.user) {
    throw new Error("You must be signed in to manage rosters.");
  }

  const membership = await prisma.clubMembership.findFirst({
    where: {
      userId: session.user.id,
    },
    include: {
      club: {
        include: {
          rosterYears: {
            include: {
              members: {
                where: {
                  isActive: true,
                },
                orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
              },
            },
            orderBy: {
              startsOn: "desc",
            },
          },
        },
      },
    },
    orderBy: {
      isPrimary: "desc",
    },
  });

  if (!membership?.club) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <h2 className="text-xl font-semibold">No club membership found</h2>
        <p className="mt-2 text-sm">
          You need an active club membership before you can manage roster years.
        </p>
      </section>
    );
  }

  const rosterYears = membership.club.rosterYears;
  const currentYearActiveRoster = rosterYears.find(
    (year) => year.yearLabel === CURRENT_YEAR_LABEL && year.isActive,
  );

  const fallbackActiveRoster = rosterYears.find((year) => year.isActive);
  const selectedRosterYear = currentYearActiveRoster ?? fallbackActiveRoster ?? null;

  const previousYearCandidate = rosterYears.find((year) => year.id !== currentYearActiveRoster?.id) ?? null;

  const canRollover = !currentYearActiveRoster && Boolean(previousYearCandidate);

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-slate-500">Roster Management</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          {membership.club.name}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Review this year&apos;s active roster, update member details, and run your annual rollover.
        </p>
      </div>

      {canRollover && previousYearCandidate ? (
        <article className="rounded-2xl border border-indigo-200 bg-indigo-50 p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-indigo-900">Start yearly rollover</h2>
              <p className="mt-1 text-sm text-indigo-800">
                No active roster was found for {CURRENT_YEAR_LABEL}. Copy active members from
                {" "}{previousYearCandidate.yearLabel} into a new active roster year.
              </p>
            </div>
            <form
              action={async () => {
                "use server";
                await executeYearlyRollover(
                  membership.club.id,
                  previousYearCandidate.id,
                  CURRENT_YEAR_LABEL,
                );
              }}
            >
              <button
                type="submit"
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
              >
                Run {CURRENT_YEAR_LABEL} Rollover
              </button>
            </form>
          </div>
        </article>
      ) : null}

      {selectedRosterYear ? (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Active Roster Year</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold text-slate-900">{selectedRosterYear.yearLabel}</h2>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                {selectedRosterYear.isActive ? "Active" : "Archived"}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                {selectedRosterYear.members.length} Active Members
              </span>
            </div>
          </div>

          <RosterTable
            rosterYearId={selectedRosterYear.id}
            members={selectedRosterYear.members.map((member) => ({
              id: member.id,
              firstName: member.firstName,
              lastName: member.lastName,
              ageAtStart: member.ageAtStart,
              gender: member.gender,
              memberRole: member.memberRole,
              medicalFlags: member.medicalFlags,
              dietaryRestrictions: member.dietaryRestrictions,
              isFirstTime: member.isFirstTime,
              isMedicalPersonnel: member.isMedicalPersonnel,
              masterGuide: member.masterGuide,
              backgroundCheckDate: member.backgroundCheckDate
                ? member.backgroundCheckDate.toISOString()
                : null,
              backgroundCheckCleared: member.backgroundCheckCleared,
              dateOfBirth: member.dateOfBirth ? member.dateOfBirth.toISOString() : null,
              emergencyContactName: member.emergencyContactName,
              emergencyContactPhone: member.emergencyContactPhone,
              isActive: member.isActive,
            }))}
          />
        </>
      ) : (
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">No roster years available</h2>
          <p className="mt-2 text-sm text-slate-600">
            Create your first roster year in the database, then return here to manage members.
          </p>
        </article>
      )}
    </section>
  );
}
