import { NominationStatus } from "@prisma/client";

import { getAdminNominations, updateNominationStatus } from "../../actions/nomination-actions";

function formatDateTime(value: Date) {
  return value.toLocaleString();
}

const adminReviewStatuses = [NominationStatus.REVIEWED, NominationStatus.WINNER];

export default async function AdminNominationsPage() {
  const nominations = await getAdminNominations();

  return (
    <section className="space-y-8">
      <header>
        <p className="text-sm font-medium text-slate-500">Awards & Nominations</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Nomination Review Queue</h1>
        <p className="mt-1 text-sm text-slate-600">
          Review submitted nominations and mark them as reviewed or winner selections.
        </p>
      </header>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Submitted Nominations</h2>

        {nominations.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No nominations have been submitted yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3">Club</th>
                  <th className="px-4 py-3">Nominee</th>
                  <th className="px-4 py-3">Award</th>
                  <th className="px-4 py-3">Year</th>
                  <th className="px-4 py-3">Justification & Leadership</th>
                  <th className="px-4 py-3">Community Service</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Review Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {nominations.map((nomination) => (
                  <tr key={nomination.id}>
                    <td className="px-4 py-3 text-slate-700">{formatDateTime(nomination.createdAt)}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <p className="font-medium text-slate-900">{nomination.club.name}</p>
                      <p className="text-xs text-slate-500">{nomination.club.code}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <p className="font-medium text-slate-900">
                        {nomination.rosterMember.firstName} {nomination.rosterMember.lastName}
                      </p>
                      <p className="text-xs text-slate-500">{nomination.rosterMember.memberRole}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{nomination.awardType}</td>
                    <td className="px-4 py-3 text-slate-700">{nomination.year}</td>
                    <td className="max-w-sm whitespace-pre-wrap px-4 py-3 text-slate-700">
                      {nomination.justificationText}
                    </td>
                    <td className="max-w-sm whitespace-pre-wrap px-4 py-3 text-slate-700">
                      {nomination.communityServiceDetails}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{nomination.status}</td>
                    <td className="px-4 py-3">
                      <form action={updateNominationStatus} className="flex items-center gap-2">
                        <input type="hidden" name="nominationId" value={nomination.id} />
                        <select
                          name="status"
                          defaultValue={nomination.status}
                          className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-900"
                        >
                          <option value={NominationStatus.SUBMITTED}>SUBMITTED</option>
                          {adminReviewStatuses.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
                        >
                          Save
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}
