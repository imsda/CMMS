CREATE TYPE "ComplianceSyncRunStatus" AS ENUM ('PREVIEW', 'APPLIED');

CREATE TYPE "AuthRateLimitScope" AS ENUM ('EMAIL_IP', 'IP');

CREATE TABLE "ComplianceSyncRun" (
  "id" TEXT NOT NULL,
  "uploadedByUserId" TEXT NOT NULL,
  "clubId" TEXT NOT NULL,
  "clubRosterYearId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "status" "ComplianceSyncRunStatus" NOT NULL DEFAULT 'PREVIEW',
  "processedRows" INTEGER NOT NULL,
  "passedRows" INTEGER NOT NULL,
  "updateCount" INTEGER NOT NULL,
  "skippedCount" INTEGER NOT NULL,
  "ambiguousCount" INTEGER NOT NULL,
  "rowResults" JSONB NOT NULL,
  "appliedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ComplianceSyncRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthRateLimitBucket" (
  "keyHash" TEXT NOT NULL,
  "scopeType" "AuthRateLimitScope" NOT NULL,
  "attemptCount" INTEGER NOT NULL,
  "windowStartedAt" TIMESTAMP(3) NOT NULL,
  "blockedUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuthRateLimitBucket_pkey" PRIMARY KEY ("keyHash")
);

CREATE INDEX "ComplianceSyncRun_clubId_createdAt_idx" ON "ComplianceSyncRun"("clubId", "createdAt");
CREATE INDEX "ComplianceSyncRun_clubRosterYearId_createdAt_idx" ON "ComplianceSyncRun"("clubRosterYearId", "createdAt");
CREATE INDEX "ComplianceSyncRun_uploadedByUserId_createdAt_idx" ON "ComplianceSyncRun"("uploadedByUserId", "createdAt");
CREATE INDEX "AuthRateLimitBucket_scopeType_updatedAt_idx" ON "AuthRateLimitBucket"("scopeType", "updatedAt");
CREATE INDEX "AuthRateLimitBucket_blockedUntil_idx" ON "AuthRateLimitBucket"("blockedUntil");

ALTER TABLE "ComplianceSyncRun"
  ADD CONSTRAINT "ComplianceSyncRun_uploadedByUserId_fkey"
  FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ComplianceSyncRun"
  ADD CONSTRAINT "ComplianceSyncRun_clubId_fkey"
  FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ComplianceSyncRun"
  ADD CONSTRAINT "ComplianceSyncRun_clubRosterYearId_fkey"
  FOREIGN KEY ("clubRosterYearId") REFERENCES "ClubRosterYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
