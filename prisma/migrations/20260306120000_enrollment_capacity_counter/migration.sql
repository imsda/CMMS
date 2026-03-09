-- Add a monotonic enrollment counter used for atomic seat reservations.
ALTER TABLE "EventClassOffering"
ADD COLUMN "enrolledCount" INTEGER NOT NULL DEFAULT 0;

UPDATE "EventClassOffering" o
SET "enrolledCount" = counts.count
FROM (
  SELECT "eventClassOfferingId", COUNT(*)::INTEGER AS count
  FROM "ClassEnrollment"
  GROUP BY "eventClassOfferingId"
) AS counts
WHERE o."id" = counts."eventClassOfferingId";
