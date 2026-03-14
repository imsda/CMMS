CREATE TYPE "MonthlyReportStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REVISION_REQUESTED');

ALTER TABLE "MonthlyReport"
ADD COLUMN "clubRosterYearId" TEXT,
ADD COLUMN "meetingDay" TEXT,
ADD COLUMN "meetingTime" TEXT,
ADD COLUMN "meetingLocation" TEXT,
ADD COLUMN "averageAttendance" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "averageTltAttendance" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "pathfinderCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "tltCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "staffCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "staffMeetingHeld" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "meetingOutingCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "devotionsEmphasis" TEXT,
ADD COLUMN "exercisePromotion" TEXT,
ADD COLUMN "outreachActivities" TEXT,
ADD COLUMN "guestHelperCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "uniformNotes" TEXT,
ADD COLUMN "honorWorkSummary" TEXT,
ADD COLUMN "honorParticipantCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "bonusNotes" TEXT,
ADD COLUMN "submittedByName" TEXT,
ADD COLUMN "submittedByUserId" TEXT,
ADD COLUMN "signedAt" TIMESTAMP(3),
ADD COLUMN "totalScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "adminComments" TEXT,
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "reviewedByUserId" TEXT,
ADD COLUMN "workflowStatus" "MonthlyReportStatus" NOT NULL DEFAULT 'DRAFT';

UPDATE "MonthlyReport"
SET
  "meetingOutingCount" = "meetingCount",
  "averageAttendance" = "averagePathfinderAttendance" + "averageStaffAttendance",
  "pathfinderCount" = "averagePathfinderAttendance",
  "staffCount" = "averageStaffAttendance",
  "totalScore" = "pointsCalculated",
  "workflowStatus" = CASE
    WHEN "status"::text = 'SUBMITTED' THEN 'SUBMITTED'::"MonthlyReportStatus"
    ELSE 'DRAFT'::"MonthlyReportStatus"
  END;

ALTER TABLE "MonthlyReport"
DROP COLUMN "meetingCount",
DROP COLUMN "pointsCalculated",
DROP COLUMN "status";

ALTER TABLE "MonthlyReport"
RENAME COLUMN "workflowStatus" TO "status";

CREATE TABLE "MonthlyReportScoreLineItem" (
    "id" TEXT NOT NULL,
    "monthlyReportId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "maxPoints" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyReportScoreLineItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MonthlyReport_status_idx" ON "MonthlyReport"("status");
CREATE INDEX "MonthlyReport_clubRosterYearId_idx" ON "MonthlyReport"("clubRosterYearId");
CREATE INDEX "MonthlyReport_submittedByUserId_idx" ON "MonthlyReport"("submittedByUserId");
CREATE INDEX "MonthlyReport_reviewedByUserId_idx" ON "MonthlyReport"("reviewedByUserId");
CREATE INDEX "MonthlyReportScoreLineItem_monthlyReportId_sortOrder_idx" ON "MonthlyReportScoreLineItem"("monthlyReportId", "sortOrder");
CREATE UNIQUE INDEX "MonthlyReportScoreLineItem_monthlyReportId_key_key" ON "MonthlyReportScoreLineItem"("monthlyReportId", "key");

ALTER TABLE "MonthlyReport" ADD CONSTRAINT "MonthlyReport_clubRosterYearId_fkey" FOREIGN KEY ("clubRosterYearId") REFERENCES "ClubRosterYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MonthlyReport" ADD CONSTRAINT "MonthlyReport_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MonthlyReport" ADD CONSTRAINT "MonthlyReport_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MonthlyReportScoreLineItem" ADD CONSTRAINT "MonthlyReportScoreLineItem_monthlyReportId_fkey" FOREIGN KEY ("monthlyReportId") REFERENCES "MonthlyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
