import { submitPublicTltRecommendation } from "../../actions/tlt-recommendation-actions";
import { prisma } from "../../../lib/prisma";

type PublicRecommendationPageProps = {
  params: {
    token: string;
  };
};

export default async function PublicRecommendationPage({ params }: PublicRecommendationPageProps) {
  const { token } = params;

  const recommendation = await prisma.tltRecommendation.findUnique({
    where: {
      secureToken: token,
    },
    include: {
      tltApplication: {
        include: {
          rosterMember: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          club: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!recommendation) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
          <h1 className="text-2xl font-semibold">Invalid recommendation link</h1>
          <p className="mt-2 text-sm">This secure link is missing or expired. Please contact the TLT applicant&apos;s club director.</p>
        </section>
      </main>
    );
  }

  if (recommendation.status === "COMPLETED") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-900">
          <h1 className="text-2xl font-semibold">Thank you!</h1>
          <p className="mt-2 text-sm">This recommendation has already been submitted and locked.</p>
        </section>
      </main>
    );
  }

  const applicantName = `${recommendation.tltApplication.rosterMember.firstName} ${recommendation.tltApplication.rosterMember.lastName}`;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <header className="space-y-2 border-b border-slate-200 pb-5">
          <p className="text-sm font-medium text-slate-500">Teen Leadership Training Recommendation</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Recommendation Form</h1>
          <p className="text-sm text-slate-600">
            Applicant: <span className="font-semibold text-slate-900">{applicantName}</span> • {recommendation.tltApplication.club.name}
          </p>
        </header>

        <form action={submitPublicTltRecommendation} className="mt-6 space-y-5">
          <input type="hidden" name="secureToken" value={recommendation.secureToken} />

          <div className="space-y-1">
            <label htmlFor="recommenderName" className="text-sm font-medium text-slate-700">
              Your name (optional)
            </label>
            <input
              id="recommenderName"
              name="recommenderName"
              type="text"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-indigo-200 focus:ring"
              placeholder="John Doe"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="relationship" className="text-sm font-medium text-slate-700">
              1) How do you know the applicant? *
            </label>
            <textarea
              id="relationship"
              name="relationship"
              required
              rows={4}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-indigo-200 focus:ring"
              placeholder="Describe your relationship and how long you have known them."
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="qualities" className="text-sm font-medium text-slate-700">
              2) How does the applicant relate to other people? *
            </label>
            <textarea
              id="qualities"
              name="qualities"
              required
              rows={4}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-indigo-200 focus:ring"
              placeholder="Comment on attitude, cooperation, and leadership potential."
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="stressResponse" className="text-sm font-medium text-slate-700">
              3) How does the applicant respond to stress or pressure? *
            </label>
            <textarea
              id="stressResponse"
              name="stressResponse"
              required
              rows={4}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-indigo-200 focus:ring"
              placeholder="Provide examples when possible."
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="potentialProblems" className="text-sm font-medium text-slate-700">
              4) Are there any potential concerns we should be aware of? *
            </label>
            <textarea
              id="potentialProblems"
              name="potentialProblems"
              required
              rows={4}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-indigo-200 focus:ring"
              placeholder="Share any caution areas or write 'None known'."
            />
          </div>

          <button
            type="submit"
            className="inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            Submit Recommendation
          </button>
        </form>
      </section>
    </main>
  );
}
