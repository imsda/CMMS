CREATE TYPE "EventTemplateCategory" AS ENUM ('BASIC_EVENTS', 'CLUB_REGISTRATION', 'CLASS_ASSIGNMENT', 'MONTHLY_REPORTS');

CREATE TYPE "EventTemplateSource" AS ENUM ('SYSTEM', 'USER');

ALTER TABLE "EventTemplate"
ADD COLUMN "templateKey" TEXT,
ADD COLUMN "eventMode" "EventMode" NOT NULL DEFAULT 'CLUB_REGISTRATION',
ADD COLUMN "category" "EventTemplateCategory" NOT NULL DEFAULT 'BASIC_EVENTS',
ADD COLUMN "source" "EventTemplateSource" NOT NULL DEFAULT 'USER',
ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "EventTemplate_templateKey_key" ON "EventTemplate"("templateKey");

CREATE INDEX "EventTemplate_source_category_isActive_updatedAt_idx"
ON "EventTemplate"("source", "category", "isActive", "updatedAt");
