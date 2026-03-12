import { auth } from "../../../auth";
import { executeYearlyRollover } from "../../actions/roster-actions";
import { decryptMedicalFields } from "../../../lib/medical-data";
import { prisma } from "../../../lib/prisma";
import { RosterTable } from "./_components/roster-table";
import { redirect } from "next/navigation";

const CURRENT_YEAR_LABEL = String(new Date().getFullYear());

export default async function DirectorRosterPage() {
  const session = await auth();

  if (!session?.user || session.user.role !== "CLUB_DIRECTOR") {
    redirect("/login");
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
      <section className="glass-panel">
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
      <div className="glass-panel">
        <p className="hero-kicker">Roster Management</p>
        <h1 className="hero-title mt-3">
          {membership.club.name}
        </h1>
        <p className="hero-copy">
          Review this year&apos;s active roster, update member details, and run your annual rollover.
        </p>
      </div>

      {canRollover && previousYearCandidate ? (
        <article className="glass-panel">
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
                className="btn-primary"
              >
                Run {CURRENT_YEAR_LABEL} Rollover
              </button>
            </form>
          </div>
        </article>
      ) : null}

      {selectedRosterYear ? (
        <>
          <div className="glass-card">
            <p className="metric-label">Active Roster Year</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold text-slate-900">{selectedRosterYear.yearLabel}</h2>
              <span className="status-chip-success">
                {selectedRosterYear.isActive ? "Active" : "Archived"}
              </span>
              <span className="status-chip-neutral">
                {selectedRosterYear.members.length} Active Members
              </span>
            </div>
          </div>

          <RosterTable
            rosterYearId={selectedRosterYear.id}
            members={selectedRosterYear.members.map((member) => {
              const decryptedMember = decryptMedicalFields(member);

              return {
                id: member.id,
                firstName: member.firstName,
                lastName: member.lastName,
                ageAtStart: member.ageAtStart,
                gender: member.gender,
                memberRole: member.memberRole,
                medicalFlags: decryptedMember.medicalFlags,
                dietaryRestrictions: decryptedMember.dietaryRestrictions,
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
                insuranceCompany: decryptedMember.insuranceCompany,
                insurancePolicyNumber: decryptedMember.insurancePolicyNumber,
                lastTetanusDate: decryptedMember.lastTetanusDate
                  ? decryptedMember.lastTetanusDate.toISOString()
                  : null,
                photoReleaseConsent: member.photoReleaseConsent,
                medicalTreatmentConsent: member.medicalTreatmentConsent,
                membershipAgreementConsent: member.membershipAgreementConsent,
                isActive: member.isActive,
              };
            })}
          />
        </>
      ) : (
        <article className="empty-state">
          <h2 className="text-lg font-semibold text-slate-900">No roster years available</h2>
          <p className="mt-2 text-sm text-slate-600">
            Create your first roster year in the database, then return here to manage members.
          </p>
        </article>
      )}
    </section>
  );
}
