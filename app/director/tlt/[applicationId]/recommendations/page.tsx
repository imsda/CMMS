import Link from "next/link";

import { getManagedClubContext } from "../../../../../lib/club-management";
import {
  retryFailedTltRecommendationInviteEmails,
  retryTltRecommendationInviteEmail,
} from "../../../../actions/tlt-recommendation-actions";
import { prisma } from "../../../../../lib/prisma";
import { RecommendationLinkGenerator } from "./_components/recommendation-link-generator";

type RecommendationManagerPageProps = {
  params: Promise<{
    applicationId: string;
  }>;
  searchParams?: Promise<{
    generated?: string;
    emails?: string;
    failed?: string;
    error?: string;
    retry?: string;
    reason?: string;
    sent?: string;
    clubId?: string;
  }>;
};

function getBaseUrl() {
  const appUrl = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
  return appUrl.replace(/\/$/, "");
}

function formatInviteDeliveryStatus(input: {
  inviteEmailStatus: "PENDING" | "SENT" | "FAILED";
  inviteEmailSentAt: Date | null;
  inviteEmailError: string | null;
}) {
  if (input.inviteEmailStatus === "SENT") {
    return input.inviteEmailSentAt ? `Sent ${input.inviteEmailSentAt.toLocaleString()}` : "Sent";
  }

  if (input.inviteEmailStatus === "FAILED") {
    return input.inviteEmailError ? `Failed: ${input.inviteEmailError}` : "Failed";
  }

  return "Not sent";
}

export default async function RecommendationManagerPage({
  params,
  searchParams,
}: RecommendationManagerPageProps) {
  const { applicationId } = await params;
  const resolvedSearchParams = await searchParams;
  const generated = resolvedSearchParams?.generated === "1";
  const emailStatus = resolvedSearchParams?.emails;
  const failedCount = Number(resolvedSearchParams?.failed ?? "0");
  const error = resolvedSearchParams?.error;
  const retryStatus = resolvedSearchParams?.retry;
  const retryReason = resolvedSearchParams?.reason;
  const retrySent = Number(resolvedSearchParams?.sent ?? "0");
  const retryFailed = Number(resolvedSearchParams?.failed ?? "0");
  const emailConfigured = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
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
        <p className="mt-2 text-sm">You need a valid club before managing recommendations.</p>
      </section>
    );
  }

  const application = await prisma.tltApplication.findFirst({
    where: {
      id: applicationId,
      clubId: club.id,
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
          {club.name} • Applicant: <span className="font-semibold text-slate-900">{applicantName}</span>
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

        {retryStatus === "success" ? (
          <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Recommendation invitation email resent successfully.
          </p>
        ) : null}

        {retryStatus === "batch" ? (
          <p className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
            Retry complete. Sent: {retrySent}. Failed: {retryFailed}.
          </p>
        ) : null}

        {retryStatus === "error" ? (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {retryReason === "email_not_configured"
              ? "Email delivery is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL."
              : retryReason === "already_completed"
                ? "This recommendation is already completed."
                : retryReason === "nothing_to_retry"
                  ? "No pending failed invites are available to retry."
                  : "Unable to resend recommendation invite email."}
          </p>
        ) : null}

        <RecommendationLinkGenerator
          tltApplicationId={application.id}
          managedClubId={managedClub.isSuperAdmin ? club.id : null}
          emailConfigured={emailConfigured}
        />
      </article>

      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Current recommendation requests</h2>
          <form action={retryFailedTltRecommendationInviteEmails}>
            <input type="hidden" name="tltApplicationId" value={application.id} />
            {managedClub.isSuperAdmin ? <input type="hidden" name="clubId" value={club.id} /> : null}
            <button
              type="submit"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={
                !emailConfigured ||
                application.recommendations.every(
                  (recommendation) =>
                    recommendation.status !== "PENDING" ||
                    (recommendation.inviteEmailStatus !== "FAILED" &&
                      recommendation.inviteEmailStatus !== "PENDING"),
                )
              }
            >
              Retry Failed Emails
            </button>
          </form>
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
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Email delivery</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Submitted</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Actions</th>
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
                        {formatInviteDeliveryStatus({
                          inviteEmailStatus: recommendation.inviteEmailStatus,
                          inviteEmailSentAt: recommendation.inviteEmailSentAt,
                          inviteEmailError: recommendation.inviteEmailError,
                        })}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {recommendation.submittedAt ? recommendation.submittedAt.toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <form action={retryTltRecommendationInviteEmail}>
                          <input type="hidden" name="tltApplicationId" value={application.id} />
                          <input type="hidden" name="recommendationId" value={recommendation.id} />
                          {managedClub.isSuperAdmin ? <input type="hidden" name="clubId" value={club.id} /> : null}
                          <button
                            type="submit"
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={
                              !emailConfigured ||
                              recommendation.status !== "PENDING" ||
                              recommendation.inviteEmailStatus === "SENT"
                            }
                          >
                            Retry Send
                          </button>
                        </form>
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
