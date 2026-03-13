CREATE INDEX "Event_createdByUserId_createdAt_idx" ON "Event"("createdByUserId", "createdAt");

ALTER TABLE "Event"
ADD CONSTRAINT "Event_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
