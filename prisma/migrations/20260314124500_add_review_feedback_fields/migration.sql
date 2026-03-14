ALTER TABLE "EventRegistration"
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "reviewedByUserId" TEXT,
ADD COLUMN "reviewerNotes" TEXT,
ADD COLUMN "revisionRequestedReason" TEXT;

ALTER TABLE "MonthlyReport"
ADD COLUMN "revisionRequestedReason" TEXT;

CREATE INDEX "EventRegistration_reviewedByUserId_idx" ON "EventRegistration"("reviewedByUserId");

ALTER TABLE "EventRegistration"
ADD CONSTRAINT "EventRegistration_reviewedByUserId_fkey"
FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
