CREATE TYPE "ComplianceSyncScope" AS ENUM ('ROSTER_YEAR', 'SYSTEM_WIDE');

ALTER TABLE "ComplianceSyncRun"
  ADD COLUMN "scope" "ComplianceSyncScope" NOT NULL DEFAULT 'ROSTER_YEAR';

ALTER TABLE "ComplianceSyncRun"
  ALTER COLUMN "clubId" DROP NOT NULL,
  ALTER COLUMN "clubRosterYearId" DROP NOT NULL;

CREATE INDEX "ComplianceSyncRun_scope_createdAt_idx" ON "ComplianceSyncRun"("scope", "createdAt");
