ALTER TYPE "RegistrationStatus" ADD VALUE IF NOT EXISTS 'REVIEWED';
ALTER TYPE "RegistrationStatus" ADD VALUE IF NOT EXISTS 'NEEDS_CHANGES';

CREATE TYPE "EventWorkflowType" AS ENUM ('STANDARD', 'CAMPOREE');

ALTER TABLE "Event"
ADD COLUMN "workflowType" "EventWorkflowType" NOT NULL DEFAULT 'STANDARD';

CREATE TABLE "CamporeeRegistration" (
    "id" TEXT NOT NULL,
    "eventRegistrationId" TEXT NOT NULL,
    "primaryContactName" TEXT NOT NULL,
    "primaryContactPhone" TEXT NOT NULL,
    "primaryContactEmail" TEXT,
    "secondaryContactName" TEXT,
    "secondaryContactPhone" TEXT,
    "campsiteType" TEXT NOT NULL,
    "tentSummary" TEXT NOT NULL,
    "trailerCount" INTEGER NOT NULL DEFAULT 0,
    "kitchenCanopyCount" INTEGER NOT NULL DEFAULT 0,
    "squareFootageNeeded" INTEGER NOT NULL DEFAULT 0,
    "campNearRequest" TEXT,
    "campsiteNotes" TEXT,
    "arrivalDateTime" TIMESTAMP(3),
    "departureDateTime" TIMESTAMP(3),
    "vehicleCount" INTEGER NOT NULL DEFAULT 0,
    "transportSummary" TEXT,
    "arrivalNotes" TEXT,
    "mealPlan" TEXT NOT NULL,
    "sabbathSupperCount" INTEGER NOT NULL DEFAULT 0,
    "sundayBreakfastCount" INTEGER NOT NULL DEFAULT 0,
    "waterServiceNeeded" BOOLEAN NOT NULL DEFAULT false,
    "foodPlanningNotes" TEXT,
    "dietaryNotes" TEXT,
    "dutyPreferences" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "participationHighlights" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "firstAidCertifiedCount" INTEGER NOT NULL DEFAULT 0,
    "leadershipStaffCount" INTEGER NOT NULL DEFAULT 0,
    "emergencyContactName" TEXT NOT NULL,
    "emergencyContactPhone" TEXT NOT NULL,
    "emergencyMeetingPoint" TEXT,
    "medicationStorageNotes" TEXT,
    "emergencyNotes" TEXT,
    "chaplainVisitRequested" BOOLEAN NOT NULL DEFAULT false,
    "worshipParticipationNotes" TEXT,
    "ministryDisplayNotes" TEXT,
    "finalReviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CamporeeRegistration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CamporeeRegistration_eventRegistrationId_key" ON "CamporeeRegistration"("eventRegistrationId");

ALTER TABLE "CamporeeRegistration"
ADD CONSTRAINT "CamporeeRegistration_eventRegistrationId_fkey"
FOREIGN KEY ("eventRegistrationId") REFERENCES "EventRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
