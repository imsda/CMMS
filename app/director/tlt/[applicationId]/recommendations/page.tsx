import Link from "next/link";

import { generateTltRecommendationLinks } from "../../../../actions/tlt-recommendation-actions";
import { auth } from "../../../../../auth";
import { prisma } from "../../../../../lib/prisma";

type RecommendationManagerPageProps = {
  params: {
    applicationId: string;
  };
  searchParams?: {
    generated?: string;
    emails?: string;
    failed?: string;
    error?: string;
  };
};

function getBaseUrl() {
  const appUrl = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
  return appUrl.replace(/\/$/, "");
}

export default async function RecommendationManagerPage({
  params,
  searchParams,
}: RecommendationManagerPageProps) {
  const { applicationId } = params;
  const generated = searchParams?.generated === "1";
  const emailStatus = searchParams?.emails;
  const failedCount = Number(searchParams?.failed ?? "0");
  const error = searchParams?.error;
  const emailConfigured = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);

  const session = await auth();

  if (!session?.user || session.user.role !== "CLUB_DIRECTOR") {
    throw new Error("Only club directors can manage TLT recommendations.");
  }

  const membership = await prisma.clubMembership.findFirst({
    where: {
      userId: session.user.id,
    },
    select: {
      clubId: true,
      club: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      isPrimary: "desc",
    },
  });

  if (!membership) {
    throw new Error("No club membership found for current user.");
  }

  const application = await prisma.tltApplication.findFirst({
    where: {
      id: applicationId,
      clubId: membership.clubId,
    },
    include: {
      rosterMember: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      recommendations: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  if (!application) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <h1 className="text-xl font-semibold">TLT application not found</h1>
        <p className="mt-2 text-sm">The selected application does not belong to your club.</p>
      </section>
    );
  }

  const applicantName = `${application.rosterMember.firstName} ${application.rosterMember.lastName}`;
  const baseUrl = getBaseUrl();

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-medium text-slate-500">Teen Leadership Training</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Recommendation Manager</h1>
        <p className="text-sm text-slate-600">
          {membership.club.name} • Applicant: <span className="font-semibold text-slate-900">{applicantName}</span>
        </p>
      </header>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Create secure recommendation links</h2>
        <p className="mt-1 text-sm text-slate-600">
          Enter 3 recommender email addresses. Existing pending links will be replaced with newly generated one-time links.
        </p>

        {generated ? (
          <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {emailStatus === "sent"
              ? "Recommendation links generated and invitation emails sent."
              : emailStatus === "partial"
                ? `Recommendation links generated. ${failedCount} email(s) failed to send.`
                : "Recommendation links generated."}
          </p>
        ) : null}

        {error === "email_not_configured" ? (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            Email delivery is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL, then try again.
          </p>
        ) : null}

        <form action={generateTltRecommendationLinks} className="mt-4 space-y-4">
          <input type="hidden" name="tltApplicationId" value={application.id} />

          {[1, 2, 3].map((slot) => (
            <div key={slot} className="space-y-1">
              <label htmlFor={`recommender-email-${slot}`} className="text-sm font-medium text-slate-700">
                Recommender {slot} email
              </label>
              <input
                id={`recommender-email-${slot}`}
                name="recommenderEmails"
                type="email"
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-indigo-200 focus:ring"
                placeholder="name@example.com"
              />
            </div>
          ))}

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              name="sendEmails"
              type="checkbox"
              disabled={!emailConfigured}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
            />
            Send invitation emails now (requires RESEND configuration)
          </label>

          <button
            type="submit"
            className="inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            Generate 3 Secure Links
          </button>
        </form>
      </article>

      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Current recommendation requests</h2>
        </div>

        {application.recommendations.length === 0 ? (
          <p className="px-6 py-5 text-sm text-slate-600">No recommendation links have been generated yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Email</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Submitted</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Secure link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {application.recommendations.map((recommendation) => {
                  const recommendationUrl = baseUrl
                    ? `${baseUrl}/recommendation/${recommendation.secureToken}`
                    : `/recommendation/${recommendation.secureToken}`;

                  return (
                    <tr key={recommendation.id}>
                      <td className="px-4 py-3 text-slate-900">{recommendation.recommenderEmail}</td>
                      <td className="px-4 py-3 text-slate-700">{recommendation.status}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {recommendation.submittedAt ? recommendation.submittedAt.toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-3 text-indigo-700">
                        <Link href={recommendationUrl} className="underline underline-offset-2">
                          {recommendationUrl}
                        </Link>
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
