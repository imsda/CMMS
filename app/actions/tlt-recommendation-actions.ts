"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "../../auth";
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

async function getDirectorClubId() {
  const session = await auth();

  if (!session?.user || session.user.role !== "CLUB_DIRECTOR") {
    throw new Error("Only club directors can manage recommendation links.");
  }

  const membership = await prisma.clubMembership.findFirst({
    where: {
      userId: session.user.id,
    },
    select: {
      clubId: true,
    },
    orderBy: {
      isPrimary: "desc",
    },
  });

  if (!membership) {
    throw new Error("No club membership found for current user.");
  }

  return membership.clubId;
}

async function sendRecommendationInviteEmail(input: { to: string; applicantName: string; recommendationUrl: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
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
    const clubId = await getDirectorClubId();
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

    if (shouldEmail && (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL)) {
      redirect(`/director/tlt/${tltApplicationId}/recommendations?error=email_not_configured`);
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
      const failedRecipients: string[] = [];

      for (const recommendation of createdRecommendations) {
        const recommendationUrl = `${baseUrl}/recommendation/${recommendation.secureToken}`;
        try {
          await sendRecommendationInviteEmail({
            to: recommendation.recommenderEmail,
            applicantName,
            recommendationUrl,
          });
        } catch {
          failedRecipients.push(recommendation.recommenderEmail);
        }
      }

      revalidatePath(`/director/tlt/${tltApplicationId}/recommendations`);

      if (failedRecipients.length > 0) {
        redirect(
          `/director/tlt/${tltApplicationId}/recommendations?generated=1&emails=partial&failed=${failedRecipients.length}`,
        );
      }

      redirect(`/director/tlt/${tltApplicationId}/recommendations?generated=1&emails=sent`);
    }

    revalidatePath(`/director/tlt/${tltApplicationId}/recommendations`);
    redirect(`/director/tlt/${tltApplicationId}/recommendations?generated=1`);
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
