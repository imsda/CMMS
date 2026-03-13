import { getDirectorNominationPageData, submitNomination } from "../../actions/nomination-actions";
import { getManagedClubContext } from "../../../lib/club-management";

const awardTypes = ["Pathfinder of the Year"];

export default async function DirectorNominationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ clubId?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const managedClub = await getManagedClubContext(resolvedSearchParams?.clubId ?? null);
  const nominationData = await getDirectorNominationPageData(managedClub.clubId);
  const currentYear = new Date().getFullYear();

  return (
    <section className="space-y-8">
      <header>
        <p className="text-sm font-medium text-slate-500">Awards & Nominations</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Submit Conference Nomination</h1>
        <p className="mt-1 text-sm text-slate-600">
          Nominate a Pathfinder from {nominationData.clubName} for conference recognition.
        </p>
      </header>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Pathfinder of the Year Nomination Form</h2>
        <p className="mt-1 text-sm text-slate-600">
          Share a clear, specific case for this Pathfinder&apos;s impact, service, and leadership.
        </p>

        {!nominationData.activeRosterYear || nominationData.activeRosterYear.members.length === 0 ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            No active roster members were found. Activate a roster year and add members before submitting a
            nomination.
          </p>
        ) : (
          <form action={submitNomination} className="mt-6 grid gap-4 md:grid-cols-2">
            {managedClub.isSuperAdmin ? <input type="hidden" name="clubId" value={managedClub.clubId} /> : null}
            <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2">
              <span>Roster Member</span>
              <select
                name="rosterMemberId"
                required
                defaultValue=""
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
              >
                <option value="" disabled>
                  Select a member from {nominationData.activeRosterYear.yearLabel}
                </option>
                {nominationData.activeRosterYear.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.lastName}, {member.firstName} ({member.memberRole})
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span>Award Type</span>
              <select
                name="awardType"
                required
                defaultValue={awardTypes[0]}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
              >
                {awardTypes.map((awardType) => (
                  <option key={awardType} value={awardType}>
                    {awardType}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span>Nomination Year</span>
              <input
                type="number"
                name="year"
                min={2000}
                max={3000}
                required
                defaultValue={currentYear}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
              />
            </label>

            <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2">
              <span>Justification</span>
              <textarea
                name="justificationText"
                rows={5}
                required
                placeholder="Why is this Pathfinder deserving of this award?"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
              />
            </label>

            <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2">
              <span>Community Service Details</span>
              <textarea
                name="communityServiceDetails"
                rows={5}
                required
                placeholder="Describe meaningful service projects, consistency, and outcomes."
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
              />
            </label>

            <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2">
              <span>Leadership</span>
              <textarea
                name="leadershipDetails"
                rows={5}
                required
                placeholder="Describe leadership shown in club life, mentoring, and initiative."
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
              />
            </label>

            <div className="md:col-span-2">
              <button
                type="submit"
                className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
              >
                Submit Nomination
              </button>
            </div>
          </form>
        )}
      </article>
    </section>
  );
}
