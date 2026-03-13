"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getManagedClubContext } from "../../lib/club-management";
import { buildDirectorPath, readManagedClubId } from "../../lib/director-path";
import { getResendConfig } from "../../lib/email/resend";
import { prisma } from "../../lib/prisma";

export type RecommendationInviteActionState = {
  status: "idle" | "error";
  message: string | null;
};

function parseRequiredString(value: FormDataEntryValue | null, fieldName: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is required.`);
  }

  return value.trim();
}

function parseOptionalString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isValidEmailAddress(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getRecommendationInviteBaseUrl() {
  const appUrl = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL;

  if (!appUrl) {
    throw new Error("NEXTAUTH_URL or NEXT_PUBLIC_APP_URL must be configured to generate recommendation links.");
  }

  return appUrl.replace(/\/$/, "");
}

function buildRecommendationPath(tltApplicationId: string, clubId: string, isSuperAdmin: boolean, query = "") {
  const basePath = buildDirectorPath(`/director/tlt/${tltApplicationId}/recommendations`, clubId, isSuperAdmin);
  if (!query) {
    return basePath;
  }

  const separator = basePath.includes("?") ? "&" : "?";
  return `${basePath}${separator}${query}`;
}

async function sendRecommendationInviteEmail(input: { to: string; applicantName: string; recommendationUrl: string }) {
  const config = getResendConfig();

  if (!config) {
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.from,
      to: [input.to],
      subject: `TLT Recommendation Request for ${input.applicantName}`,
      html: `<p>Hello,</p><p>You have been requested to submit a TLT recommendation for <strong>${input.applicantName}</strong>.</p><p>Please complete the secure form using this one-time link:</p><p><a href="${input.recommendationUrl}">${input.recommendationUrl}</a></p><p>Thank you for supporting this applicant.</p>`,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send recommendation email: ${response.status} ${errorText}`);
  }
}

function toInviteEmailErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.slice(0, 500);
  }

  return "Unknown email delivery failure.";
}

function isRedirectError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

export async function generateTltRecommendationLinks(
  _prevState: RecommendationInviteActionState,
  formData: FormData,
): Promise<RecommendationInviteActionState> {
  try {
    const managedClub = await getManagedClubContext(readManagedClubId(formData.get("clubId")));
    const clubId = managedClub.clubId;
    const tltApplicationId = parseRequiredString(formData.get("tltApplicationId"), "TLT application");
    const shouldEmail = formData.get("sendEmails") === "on";

    const emailEntries = formData
      .getAll("recommenderEmails")
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry.length > 0);

    if (emailEntries.length !== 3) {
      throw new Error("Exactly 3 recommendation email addresses are required.");
    }

    const uniqueEmails = new Set(emailEntries);
    if (uniqueEmails.size !== emailEntries.length) {
      throw new Error("Recommendation email addresses must be unique.");
    }

    if (!emailEntries.every(isValidEmailAddress)) {
      throw new Error("Each recommendation email must be a valid email address.");
    }

    if (shouldEmail && !getResendConfig()) {
      redirect(buildRecommendationPath(tltApplicationId, clubId, managedClub.isSuperAdmin, "error=email_not_configured"));
    }

    const application = await prisma.tltApplication.findFirst({
    where: {
      id: tltApplicationId,
      clubId,
    },
    include: {
      rosterMember: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

    if (!application) {
      throw new Error("TLT application not found for your club.");
    }

    const createdRecommendations = await prisma.$transaction(async (tx) => {
    await tx.tltRecommendation.deleteMany({
      where: {
        tltApplicationId,
        status: "PENDING",
      },
    });

    const recommendationCreates = emailEntries.map((email) =>
      tx.tltRecommendation.create({
        data: {
          tltApplicationId,
          recommenderEmail: email,
          secureToken: randomUUID(),
        },
      }),
    );

    return Promise.all(recommendationCreates);
    });

    if (shouldEmail) {
      const applicantName = `${application.rosterMember.firstName} ${application.rosterMember.lastName}`;
      const baseUrl = getRecommendationInviteBaseUrl();
      let failedCount = 0;

      for (const recommendation of createdRecommendations) {
        const recommendationUrl = `${baseUrl}/recommendation/${recommendation.secureToken}`;
        try {
          await sendRecommendationInviteEmail({
            to: recommendation.recommenderEmail,
            applicantName,
            recommendationUrl,
          });

          await prisma.tltRecommendation.update({
            where: {
              id: recommendation.id,
            },
            data: {
              inviteEmailStatus: "SENT",
              inviteEmailSentAt: new Date(),
              inviteEmailError: null,
            },
          });
        } catch (error) {
          failedCount += 1;

          await prisma.tltRecommendation.update({
            where: {
              id: recommendation.id,
            },
            data: {
              inviteEmailStatus: "FAILED",
              inviteEmailError: toInviteEmailErrorMessage(error),
            },
          });
        }
      }

      revalidatePath(`/director/tlt/${tltApplicationId}/recommendations`);

      if (failedCount > 0) {
        redirect(buildRecommendationPath(tltApplicationId, clubId, managedClub.isSuperAdmin, `generated=1&emails=partial&failed=${failedCount}`));
      }

      redirect(buildRecommendationPath(tltApplicationId, clubId, managedClub.isSuperAdmin, "generated=1&emails=sent"));
    }

    revalidatePath(`/director/tlt/${tltApplicationId}/recommendations`);
    redirect(buildRecommendationPath(tltApplicationId, clubId, managedClub.isSuperAdmin, "generated=1"));
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to generate recommendation links.",
    };
  }
}

export async function submitPublicTltRecommendation(formData: FormData) {
  const secureToken = parseRequiredString(formData.get("secureToken"), "Recommendation token");

  const recommendation = await prisma.tltRecommendation.findUnique({
    where: {
      secureToken,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!recommendation) {
    throw new Error("Invalid recommendation link.");
  }

  if (recommendation.status === "COMPLETED") {
    redirect(`/recommendation/${secureToken}`);
  }

  const updateResult = await prisma.tltRecommendation.updateMany({
    where: {
      id: recommendation.id,
      status: "PENDING",
    },
    data: {
      recommenderName: parseOptionalString(formData.get("recommenderName")),
      relationship: parseRequiredString(formData.get("relationship"), "Relationship"),
      qualities: parseRequiredString(formData.get("qualities"), "People relationship response"),
      stressResponse: parseRequiredString(formData.get("stressResponse"), "Stress response"),
      potentialProblems: parseRequiredString(formData.get("potentialProblems"), "Potential problems"),
      status: "COMPLETED",
      submittedAt: new Date(),
    },
  });

  if (updateResult.count === 0) {
    throw new Error("This recommendation has already been submitted.");
  }

  revalidatePath(`/recommendation/${secureToken}`);
  redirect(`/recommendation/${secureToken}`);
}

export async function retryTltRecommendationInviteEmail(formData: FormData) {
  const managedClub = await getManagedClubContext(readManagedClubId(formData.get("clubId")));
  const clubId = managedClub.clubId;
  const tltApplicationId = parseRequiredString(formData.get("tltApplicationId"), "TLT application");
  const recommendationId = parseRequiredString(formData.get("recommendationId"), "Recommendation");

  if (!getResendConfig()) {
    redirect(buildRecommendationPath(tltApplicationId, clubId, managedClub.isSuperAdmin, "retry=error&reason=email_not_configured"));
  }

  const recommendation = await prisma.tltRecommendation.findFirst({
    where: {
      id: recommendationId,
      tltApplicationId,
      tltApplication: {
        clubId,
      },
    },
    select: {
      id: true,
      recommenderEmail: true,
      secureToken: true,
      status: true,
      tltApplication: {
        select: {
          rosterMember: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  if (!recommendation) {
    redirect(buildRecommendationPath(tltApplicationId, clubId, managedClub.isSuperAdmin, "retry=error&reason=not_found"));
  }

  if (recommendation.status === "COMPLETED") {
    redirect(buildRecommendationPath(tltApplicationId, clubId, managedClub.isSuperAdmin, "retry=error&reason=already_completed"));
  }

  const recommendationUrl = `${getRecommendationInviteBaseUrl()}/recommendation/${recommendation.secureToken}`;
  const applicantName = `${recommendation.tltApplication.rosterMember.firstName} ${recommendation.tltApplication.rosterMember.lastName}`;

  try {
    await sendRecommendationInviteEmail({
      to: recommendation.recommenderEmail,
      applicantName,
      recommendationUrl,
    });

    await prisma.tltRecommendation.update({
      where: {
        id: recommendation.id,
      },
      data: {
        inviteEmailStatus: "SENT",
        inviteEmailSentAt: new Date(),
        inviteEmailError: null,
      },
    });

    revalidatePath(`/director/tlt/${tltApplicationId}/recommendations`);
    redirect(buildRecommendationPath(tltApplicationId, clubId, managedClub.isSuperAdmin, "retry=success"));
  } catch (error) {
    await prisma.tltRecommendation.update({
      where: {
        id: recommendation.id,
      },
      data: {
        inviteEmailStatus: "FAILED",
        inviteEmailError: toInviteEmailErrorMessage(error),
      },
    });

    revalidatePath(`/director/tlt/${tltApplicationId}/recommendations`);
    redirect(buildRecommendationPath(tltApplicationId, clubId, managedClub.isSuperAdmin, "retry=error&reason=send_failed"));
  }
}

export async function retryFailedTltRecommendationInviteEmails(formData: FormData) {
  const managedClub = await getManagedClubContext(readManagedClubId(formData.get("clubId")));
  const clubId = managedClub.clubId;
  const tltApplicationId = parseRequiredString(formData.get("tltApplicationId"), "TLT application");

  if (!getResendConfig()) {
    redirect(buildRecommendationPath(tltApplicationId, clubId, managedClub.isSuperAdmin, "retry=error&reason=email_not_configured"));
  }

  const application = await prisma.tltApplication.findFirst({
    where: {
      id: tltApplicationId,
      clubId,
    },
    select: {
      id: true,
      rosterMember: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      recommendations: {
        where: {
          status: "PENDING",
          inviteEmailStatus: {
            in: ["FAILED", "PENDING"],
          },
        },
        select: {
          id: true,
          recommenderEmail: true,
          secureToken: true,
        },
      },
    },
  });

  if (!application) {
    redirect(buildRecommendationPath(tltApplicationId, clubId, managedClub.isSuperAdmin, "retry=error&reason=not_found"));
  }

  if (application.recommendations.length === 0) {
    redirect(buildRecommendationPath(tltApplicationId, clubId, managedClub.isSuperAdmin, "retry=error&reason=nothing_to_retry"));
  }

  const applicantName = `${application.rosterMember.firstName} ${application.rosterMember.lastName}`;
  const baseUrl = getRecommendationInviteBaseUrl();
  let successCount = 0;
  let failedCount = 0;

  for (const recommendation of application.recommendations) {
    const recommendationUrl = `${baseUrl}/recommendation/${recommendation.secureToken}`;
    try {
      await sendRecommendationInviteEmail({
        to: recommendation.recommenderEmail,
        applicantName,
        recommendationUrl,
      });

      await prisma.tltRecommendation.update({
        where: {
          id: recommendation.id,
        },
        data: {
          inviteEmailStatus: "SENT",
          inviteEmailSentAt: new Date(),
          inviteEmailError: null,
        },
      });
      successCount += 1;
    } catch (error) {
      await prisma.tltRecommendation.update({
        where: {
          id: recommendation.id,
        },
        data: {
          inviteEmailStatus: "FAILED",
          inviteEmailError: toInviteEmailErrorMessage(error),
        },
      });
      failedCount += 1;
    }
  }

  revalidatePath(`/director/tlt/${tltApplicationId}/recommendations`);
  redirect(buildRecommendationPath(tltApplicationId, clubId, managedClub.isSuperAdmin, `retry=batch&sent=${successCount}&failed=${failedCount}`));
}
