ALTER TABLE "ComplianceSyncRun"
ADD COLUMN "appliedByUserId" TEXT;

CREATE INDEX "ComplianceSyncRun_appliedByUserId_createdAt_idx"
ON "ComplianceSyncRun"("appliedByUserId", "createdAt");

ALTER TABLE "ComplianceSyncRun"
ADD CONSTRAINT "ComplianceSyncRun_appliedByUserId_fkey"
FOREIGN KEY ("appliedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
