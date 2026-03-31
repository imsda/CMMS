import { createRosterYear, executeYearlyRollover } from "../../actions/roster-actions";
import { getTranslations } from "next-intl/server";
import { getManagedClubContext } from "../../../lib/club-management";
import { decryptMedicalFields } from "../../../lib/medical-data";
import { prisma } from "../../../lib/prisma";
import { RosterTable } from "./_components/roster-table";

const CURRENT_YEAR_LABEL = String(new Date().getFullYear());

export default async function DirectorRosterPage({
  searchParams,
}: {
  searchParams?: Promise<{ clubId?: string }>;
}) {
  const t = await getTranslations("Director");
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const managedClub = await getManagedClubContext(resolvedSearchParams?.clubId ?? null);

  const club = await prisma.club.findUnique({
    where: {
      id: managedClub.clubId,
    },
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
  });

  if (!club) {
    return (
      <section className="glass-panel">
        <h2 className="text-xl font-semibold">{t("common.clubNotFound")}</h2>
        <p className="mt-2 text-sm">{t("roster.clubNotFoundDescription")}</p>
      </section>
    );
  }

  const rosterYears = club.rosterYears;
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
        <p className="hero-kicker">{t("roster.eyebrow")}</p>
        <h1 className="hero-title mt-3">{club.name}</h1>
        <p className="hero-copy">{t("roster.description")}</p>
      </div>

      {canRollover && previousYearCandidate ? (
        <article className="glass-panel">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-indigo-900">{t("roster.startRollover")}</h2>
              <p className="mt-1 text-sm text-indigo-800">
                {t("roster.rolloverDescription", {
                  year: CURRENT_YEAR_LABEL,
                  previousYear: previousYearCandidate.yearLabel,
                })}
              </p>
            </div>
            <form
              action={async () => {
                "use server";
                await executeYearlyRollover(club.id, previousYearCandidate.id, CURRENT_YEAR_LABEL, managedClub.clubId);
              }}
            >
              <button
                type="submit"
                className="btn-primary"
              >
                {t("roster.runRollover", { year: CURRENT_YEAR_LABEL })}
              </button>
            </form>
          </div>
        </article>
      ) : null}

      {selectedRosterYear ? (
        <>
          <div className="glass-card">
            <p className="metric-label">{t("roster.activeRosterYear")}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold text-slate-900">{selectedRosterYear.yearLabel}</h2>
              <span className="status-chip-success">
                {selectedRosterYear.isActive ? t("common.active") : t("common.archived")}
              </span>
              <span className="status-chip-neutral">
                {t("roster.activeMembers", { count: selectedRosterYear.members.length })}
              </span>
            </div>
          </div>

          <RosterTable
            rosterYearId={selectedRosterYear.id}
            managedClubId={managedClub.isSuperAdmin ? managedClub.clubId : null}
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
                swimTestCleared: member.swimTestCleared,
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
          <h2 className="text-lg font-semibold text-slate-900">{t("roster.noRosterYears")}</h2>
          <p className="mt-2 text-sm text-slate-600">
            {t("roster.noRosterYearsDescription", { year: CURRENT_YEAR_LABEL })}
          </p>
          <form
            className="mt-4"
            action={async () => {
              "use server";
              await createRosterYear(CURRENT_YEAR_LABEL, managedClub.clubId);
            }}
          >
            <button
              type="submit"
              className="btn-primary"
            >
              {t("roster.createRosterYear", { year: CURRENT_YEAR_LABEL })}
            </button>
          </form>
        </article>
      )}
    </section>
  );
}
