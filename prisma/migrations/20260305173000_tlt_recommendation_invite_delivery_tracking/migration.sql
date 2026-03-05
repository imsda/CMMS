-- CreateEnum
CREATE TYPE "TltRecommendationInviteEmailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "TltRecommendation"
ADD COLUMN "inviteEmailStatus" "TltRecommendationInviteEmailStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "inviteEmailSentAt" TIMESTAMP(3),
ADD COLUMN "inviteEmailError" TEXT;

-- CreateIndex
CREATE INDEX "TltRecommendation_inviteEmailStatus_idx" ON "TltRecommendation"("inviteEmailStatus");
