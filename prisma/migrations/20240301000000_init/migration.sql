-- ============================================================
-- Initial migration – generated from prisma/schema.prisma
-- Covers all models as of the alignment audit on 2024-03-01.
--
-- Deploy with:  npx prisma migrate deploy
-- ============================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE "UserRole" AS ENUM (
  'SUPER_ADMIN',
  'CLUB_DIRECTOR',
  'STAFF_TEACHER',
  'STUDENT_PARENT'
);

CREATE TYPE "ClubType" AS ENUM (
  'PATHFINDER',
  'ADVENTURER',
  'EAGER_BEAVER'
);

CREATE TYPE "MemberRole" AS ENUM (
  'PATHFINDER',
  'ADVENTURER',
  'TLT',
  'STAFF',
  'CHILD',
  'DIRECTOR',
  'COUNSELOR'
);

CREATE TYPE "Gender" AS ENUM (
  'MALE',
  'FEMALE',
  'NON_BINARY',
  'PREFER_NOT_TO_SAY'
);

CREATE TYPE "RolloverStatus" AS ENUM (
  'CONTINUING',
  'ARCHIVED',
  'GRADUATED',
  'NEW'
);

CREATE TYPE "RegistrationStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED'
);

CREATE TYPE "PaymentStatus" AS ENUM (
  'PENDING',
  'PARTIAL',
  'PAID'
);

CREATE TYPE "FormFieldType" AS ENUM (
  'SHORT_TEXT',
  'LONG_TEXT',
  'NUMBER',
  'BOOLEAN',
  'DATE',
  'SINGLE_SELECT',
  'MULTI_SELECT',
  'ROSTER_SELECT',
  'ROSTER_MULTI_SELECT',
  'FIELD_GROUP'
);

CREATE TYPE "ClassType" AS ENUM (
  'HONOR',
  'SPECIALTY',
  'WORKSHOP',
  'REQUIRED'
);

CREATE TYPE "RequirementType" AS ENUM (
  'MIN_AGE',
  'MAX_AGE',
  'MEMBER_ROLE',
  'COMPLETED_HONOR',
  'MASTER_GUIDE'
);

CREATE TYPE "ReportStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED'
);

CREATE TYPE "NominationStatus" AS ENUM (
  'SUBMITTED',
  'REVIEWED',
  'WINNER'
);

CREATE TYPE "TltApplicationStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED'
);

CREATE TYPE "TltRecommendationStatus" AS ENUM (
  'PENDING',
  'COMPLETED'
);

-- ---------------------------------------------------------------------------
-- User
-- ---------------------------------------------------------------------------

CREATE TABLE "User" (
    "id"           TEXT         NOT NULL,
    "email"        TEXT         NOT NULL,
    "name"         TEXT         NOT NULL,
    "role"         "UserRole"   NOT NULL,
    "passwordHash" TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- ---------------------------------------------------------------------------
-- Club
-- ---------------------------------------------------------------------------

CREATE TABLE "Club" (
    "id"        TEXT        NOT NULL,
    "name"      TEXT        NOT NULL,
    "code"      TEXT        NOT NULL,
    "type"      "ClubType"  NOT NULL,
    "city"      TEXT,
    "state"     TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Club_code_key" ON "Club"("code");

-- ---------------------------------------------------------------------------
-- ClubMembership
-- ---------------------------------------------------------------------------

CREATE TABLE "ClubMembership" (
    "id"        TEXT         NOT NULL,
    "clubId"    TEXT         NOT NULL,
    "userId"    TEXT         NOT NULL,
    "title"     TEXT,
    "isPrimary" BOOLEAN      NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClubMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClubMembership_clubId_userId_key" ON "ClubMembership"("clubId", "userId");
CREATE INDEX "ClubMembership_userId_idx" ON "ClubMembership"("userId");

-- ---------------------------------------------------------------------------
-- ClubRosterYear
-- ---------------------------------------------------------------------------

CREATE TABLE "ClubRosterYear" (
    "id"               TEXT         NOT NULL,
    "clubId"           TEXT         NOT NULL,
    "yearLabel"        TEXT         NOT NULL,
    "startsOn"         TIMESTAMP(3) NOT NULL,
    "endsOn"           TIMESTAMP(3) NOT NULL,
    "isActive"         BOOLEAN      NOT NULL DEFAULT true,
    "copiedFromYearId" TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClubRosterYear_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClubRosterYear_clubId_yearLabel_key" ON "ClubRosterYear"("clubId", "yearLabel");
CREATE INDEX "ClubRosterYear_clubId_isActive_idx" ON "ClubRosterYear"("clubId", "isActive");

-- ---------------------------------------------------------------------------
-- RosterMember
-- ---------------------------------------------------------------------------

CREATE TABLE "RosterMember" (
    "id"                         TEXT             NOT NULL,
    "clubRosterYearId"           TEXT             NOT NULL,
    "firstName"                  TEXT             NOT NULL,
    "lastName"                   TEXT             NOT NULL,
    "dateOfBirth"                TIMESTAMP(3),
    "ageAtStart"                 INTEGER,
    "gender"                     "Gender",
    "memberRole"                 "MemberRole"     NOT NULL,
    "medicalFlags"               TEXT,
    "dietaryRestrictions"        TEXT,
    "isFirstTime"                BOOLEAN          NOT NULL DEFAULT false,
    "isMedicalPersonnel"         BOOLEAN          NOT NULL DEFAULT false,
    "masterGuide"                BOOLEAN          NOT NULL DEFAULT false,
    "backgroundCheckDate"        TIMESTAMP(3),
    "backgroundCheckCleared"     BOOLEAN          NOT NULL DEFAULT false,
    "rolloverStatus"             "RolloverStatus" NOT NULL DEFAULT 'CONTINUING',
    "isActive"                   BOOLEAN          NOT NULL DEFAULT true,
    "emergencyContactName"       TEXT,
    "emergencyContactPhone"      TEXT,
    "insuranceCompany"           TEXT,
    "insurancePolicyNumber"      TEXT,
    "insuranceCardFilename"      TEXT,
    "lastTetanusDate"            TIMESTAMP(3),
    "photoReleaseConsent"        BOOLEAN          NOT NULL DEFAULT false,
    "medicalTreatmentConsent"    BOOLEAN          NOT NULL DEFAULT false,
    "membershipAgreementConsent" BOOLEAN          NOT NULL DEFAULT false,
    "createdAt"                  TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"                  TIMESTAMP(3)     NOT NULL,

    CONSTRAINT "RosterMember_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RosterMember_clubRosterYearId_isActive_idx" ON "RosterMember"("clubRosterYearId", "isActive");
CREATE INDEX "RosterMember_lastName_firstName_idx" ON "RosterMember"("lastName", "firstName");

-- ---------------------------------------------------------------------------
-- TltApplication
-- ---------------------------------------------------------------------------

CREATE TABLE "TltApplication" (
    "id"               TEXT                 NOT NULL,
    "rosterMemberId"   TEXT                 NOT NULL,
    "clubId"           TEXT                 NOT NULL,
    "grade"            INTEGER              NOT NULL,
    "citizenship"      TEXT                 NOT NULL,
    "isBaptized"       BOOLEAN              NOT NULL,
    "tltYearWorkingOn" INTEGER              NOT NULL,
    "schoolName"       TEXT                 NOT NULL,
    "schoolAddress"    TEXT                 NOT NULL,
    "classesCompleted" JSONB                NOT NULL,
    "tShirtSize"       TEXT                 NOT NULL,
    "poloSize"         TEXT                 NOT NULL,
    "status"           "TltApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt"        TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TltApplication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TltApplication_rosterMemberId_key" ON "TltApplication"("rosterMemberId");
CREATE INDEX "TltApplication_clubId_status_idx" ON "TltApplication"("clubId", "status");

-- ---------------------------------------------------------------------------
-- TltRecommendation
-- ---------------------------------------------------------------------------

CREATE TABLE "TltRecommendation" (
    "id"                TEXT                      NOT NULL,
    "tltApplicationId"  TEXT                      NOT NULL,
    "secureToken"       TEXT                      NOT NULL,
    "recommenderName"   TEXT,
    "recommenderEmail"  TEXT                      NOT NULL,
    "relationship"      TEXT,
    "qualities"         TEXT,
    "stressResponse"    TEXT,
    "potentialProblems" TEXT,
    "status"            "TltRecommendationStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt"       TIMESTAMP(3),
    "createdAt"         TIMESTAMP(3)              NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3)              NOT NULL,

    CONSTRAINT "TltRecommendation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TltRecommendation_secureToken_key" ON "TltRecommendation"("secureToken");
CREATE INDEX "TltRecommendation_tltApplicationId_idx" ON "TltRecommendation"("tltApplicationId");
CREATE INDEX "TltRecommendation_status_idx" ON "TltRecommendation"("status");

-- ---------------------------------------------------------------------------
-- Nomination
-- ---------------------------------------------------------------------------

CREATE TABLE "Nomination" (
    "id"                      TEXT               NOT NULL,
    "clubId"                  TEXT               NOT NULL,
    "rosterMemberId"          TEXT               NOT NULL,
    "awardType"               TEXT               NOT NULL,
    "year"                    INTEGER            NOT NULL,
    "justificationText"       TEXT               NOT NULL,
    "communityServiceDetails" TEXT               NOT NULL,
    "status"                  "NominationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "createdAt"               TIMESTAMP(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"               TIMESTAMP(3)       NOT NULL,

    CONSTRAINT "Nomination_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Nomination_clubId_year_idx" ON "Nomination"("clubId", "year");
CREATE INDEX "Nomination_status_idx" ON "Nomination"("status");

-- ---------------------------------------------------------------------------
-- Event
-- ---------------------------------------------------------------------------

CREATE TABLE "Event" (
    "id"                   TEXT         NOT NULL,
    "name"                 TEXT         NOT NULL,
    "slug"                 TEXT         NOT NULL,
    "description"          TEXT,
    "startsAt"             TIMESTAMP(3) NOT NULL,
    "endsAt"               TIMESTAMP(3) NOT NULL,
    "registrationOpensAt"  TIMESTAMP(3) NOT NULL,
    "registrationClosesAt" TIMESTAMP(3) NOT NULL,
    "basePrice"            DOUBLE PRECISION NOT NULL,
    "lateFeePrice"         DOUBLE PRECISION NOT NULL,
    "lateFeeStartsAt"      TIMESTAMP(3) NOT NULL,
    "locationName"         TEXT,
    "locationAddress"      TEXT,
    "createdByUserId"      TEXT,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");

-- ---------------------------------------------------------------------------
-- EventFormField
-- ---------------------------------------------------------------------------

CREATE TABLE "EventFormField" (
    "id"            TEXT           NOT NULL,
    "eventId"       TEXT           NOT NULL,
    "parentFieldId" TEXT,
    "key"           TEXT           NOT NULL,
    "label"         TEXT           NOT NULL,
    "description"   TEXT,
    "type"          "FormFieldType" NOT NULL,
    "options"       JSONB,
    "isRequired"    BOOLEAN        NOT NULL DEFAULT false,
    "sortOrder"     INTEGER        NOT NULL DEFAULT 0,

    CONSTRAINT "EventFormField_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventFormField_eventId_key_key" ON "EventFormField"("eventId", "key");
CREATE INDEX "EventFormField_eventId_sortOrder_idx" ON "EventFormField"("eventId", "sortOrder");
CREATE INDEX "EventFormField_eventId_parentFieldId_idx" ON "EventFormField"("eventId", "parentFieldId");

-- ---------------------------------------------------------------------------
-- EventRegistration
-- ---------------------------------------------------------------------------

CREATE TABLE "EventRegistration" (
    "id"                   TEXT                 NOT NULL,
    "eventId"              TEXT                 NOT NULL,
    "clubId"               TEXT                 NOT NULL,
    "registrationCode"     TEXT                 NOT NULL,
    "status"               "RegistrationStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt"          TIMESTAMP(3),
    "approvedAt"           TIMESTAMP(3),
    "overrideLimitsAllowed" BOOLEAN             NOT NULL DEFAULT false,
    "notes"                TEXT,
    "totalDue"             DOUBLE PRECISION     NOT NULL,
    "amountPaid"           DOUBLE PRECISION     NOT NULL DEFAULT 0,
    "paymentStatus"        "PaymentStatus"      NOT NULL DEFAULT 'PENDING',
    "createdAt"            TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3)         NOT NULL,

    CONSTRAINT "EventRegistration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventRegistration_registrationCode_key" ON "EventRegistration"("registrationCode");
CREATE UNIQUE INDEX "EventRegistration_eventId_clubId_key" ON "EventRegistration"("eventId", "clubId");
CREATE INDEX "EventRegistration_clubId_status_idx" ON "EventRegistration"("clubId", "status");

-- ---------------------------------------------------------------------------
-- RegistrationAttendee
-- ---------------------------------------------------------------------------

CREATE TABLE "RegistrationAttendee" (
    "id"                  TEXT         NOT NULL,
    "eventRegistrationId" TEXT         NOT NULL,
    "rosterMemberId"      TEXT         NOT NULL,
    "checkedInAt"         TIMESTAMP(3),
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrationAttendee_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RegistrationAttendee_eventRegistrationId_rosterMemberId_key"
    ON "RegistrationAttendee"("eventRegistrationId", "rosterMemberId");
CREATE INDEX "RegistrationAttendee_rosterMemberId_idx" ON "RegistrationAttendee"("rosterMemberId");

-- ---------------------------------------------------------------------------
-- ClassCatalog
-- ---------------------------------------------------------------------------

CREATE TABLE "ClassCatalog" (
    "id"          TEXT        NOT NULL,
    "title"       TEXT        NOT NULL,
    "code"        TEXT        NOT NULL,
    "description" TEXT,
    "classType"   "ClassType" NOT NULL,
    "active"      BOOLEAN     NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassCatalog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClassCatalog_code_key" ON "ClassCatalog"("code");

-- ---------------------------------------------------------------------------
-- ClassRequirement
-- ---------------------------------------------------------------------------

CREATE TABLE "ClassRequirement" (
    "id"                  TEXT              NOT NULL,
    "classCatalogId"      TEXT              NOT NULL,
    "requirementType"     "RequirementType" NOT NULL,
    "minAge"              INTEGER,
    "maxAge"              INTEGER,
    "requiredMemberRole"  "MemberRole",
    "requiredHonorCode"   TEXT,
    "requiredMasterGuide" BOOLEAN           NOT NULL DEFAULT false,

    CONSTRAINT "ClassRequirement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClassRequirement_classCatalogId_idx" ON "ClassRequirement"("classCatalogId");

-- ---------------------------------------------------------------------------
-- EventClassOffering
-- ---------------------------------------------------------------------------

CREATE TABLE "EventClassOffering" (
    "id"             TEXT         NOT NULL,
    "eventId"        TEXT         NOT NULL,
    "classCatalogId" TEXT         NOT NULL,
    "teacherUserId"  TEXT,
    "capacity"       INTEGER,
    "startsAt"       TIMESTAMP(3),
    "endsAt"         TIMESTAMP(3),
    "location"       TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventClassOffering_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventClassOffering_eventId_classCatalogId_key"
    ON "EventClassOffering"("eventId", "classCatalogId");
CREATE INDEX "EventClassOffering_teacherUserId_idx" ON "EventClassOffering"("teacherUserId");

-- ---------------------------------------------------------------------------
-- ClassEnrollment
-- ---------------------------------------------------------------------------

CREATE TABLE "ClassEnrollment" (
    "id"                   TEXT         NOT NULL,
    "eventClassOfferingId" TEXT         NOT NULL,
    "rosterMemberId"       TEXT         NOT NULL,
    "isWaitlisted"         BOOLEAN      NOT NULL DEFAULT false,
    "assignedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassEnrollment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClassEnrollment_eventClassOfferingId_rosterMemberId_key"
    ON "ClassEnrollment"("eventClassOfferingId", "rosterMemberId");
CREATE INDEX "ClassEnrollment_rosterMemberId_idx" ON "ClassEnrollment"("rosterMemberId");

-- ---------------------------------------------------------------------------
-- MemberRequirement
-- ---------------------------------------------------------------------------

CREATE TABLE "MemberRequirement" (
    "id"              TEXT              NOT NULL,
    "rosterMemberId"  TEXT              NOT NULL,
    "honorCode"       TEXT              NOT NULL,
    "requirementType" "RequirementType" NOT NULL,
    "metadata"        JSONB,
    "completedAt"     TIMESTAMP(3)      NOT NULL,
    "createdAt"       TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberRequirement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MemberRequirement_rosterMemberId_requirementType_idx"
    ON "MemberRequirement"("rosterMemberId", "requirementType");

-- ---------------------------------------------------------------------------
-- EventFormResponse
-- ---------------------------------------------------------------------------

CREATE TABLE "EventFormResponse" (
    "id"                  TEXT         NOT NULL,
    "eventRegistrationId" TEXT         NOT NULL,
    "eventFormFieldId"    TEXT         NOT NULL,
    "attendeeId"          TEXT,
    "value"               JSONB        NOT NULL,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventFormResponse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventFormResponse_eventRegistrationId_eventFormFieldId_attendeeId_key"
    ON "EventFormResponse"("eventRegistrationId", "eventFormFieldId", "attendeeId");
CREATE INDEX "EventFormResponse_eventRegistrationId_idx" ON "EventFormResponse"("eventRegistrationId");
CREATE INDEX "EventFormResponse_eventFormFieldId_idx" ON "EventFormResponse"("eventFormFieldId");
CREATE INDEX "EventFormResponse_attendeeId_idx" ON "EventFormResponse"("attendeeId");

-- ---------------------------------------------------------------------------
-- MonthlyReport
-- ---------------------------------------------------------------------------

CREATE TABLE "MonthlyReport" (
    "id"                          TEXT           NOT NULL,
    "clubId"                      TEXT           NOT NULL,
    "reportMonth"                 TIMESTAMP(3)   NOT NULL,
    "meetingCount"                INTEGER        NOT NULL,
    "averagePathfinderAttendance"  INTEGER        NOT NULL,
    "averageStaffAttendance"       INTEGER        NOT NULL,
    "uniformCompliance"           INTEGER        NOT NULL,
    "pointsCalculated"            INTEGER        NOT NULL,
    "status"                      "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt"                 TIMESTAMP(3),
    "createdAt"                   TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"                   TIMESTAMP(3)   NOT NULL,

    CONSTRAINT "MonthlyReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MonthlyReport_clubId_reportMonth_key" ON "MonthlyReport"("clubId", "reportMonth");
CREATE INDEX "MonthlyReport_reportMonth_idx" ON "MonthlyReport"("reportMonth");
CREATE INDEX "MonthlyReport_status_idx" ON "MonthlyReport"("status");

-- ---------------------------------------------------------------------------
-- YearEndReport
-- ---------------------------------------------------------------------------

CREATE TABLE "YearEndReport" (
    "id"                   TEXT           NOT NULL,
    "clubId"               TEXT           NOT NULL,
    "reportYear"           INTEGER        NOT NULL,
    "friendCompletions"    INTEGER        NOT NULL DEFAULT 0,
    "companionCompletions" INTEGER        NOT NULL DEFAULT 0,
    "explorerCompletions"  INTEGER        NOT NULL DEFAULT 0,
    "rangerCompletions"    INTEGER        NOT NULL DEFAULT 0,
    "voyagerCompletions"   INTEGER        NOT NULL DEFAULT 0,
    "guideCompletions"     INTEGER        NOT NULL DEFAULT 0,
    "status"               "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt"          TIMESTAMP(3),
    "createdAt"            TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3)   NOT NULL,

    CONSTRAINT "YearEndReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "YearEndReport_clubId_reportYear_key" ON "YearEndReport"("clubId", "reportYear");
CREATE INDEX "YearEndReport_reportYear_idx" ON "YearEndReport"("reportYear");
CREATE INDEX "YearEndReport_status_idx" ON "YearEndReport"("status");

-- ---------------------------------------------------------------------------
-- Foreign keys (added after all tables so ordering doesn't matter)
-- ---------------------------------------------------------------------------

-- ClubMembership
ALTER TABLE "ClubMembership" ADD CONSTRAINT "ClubMembership_clubId_fkey"
    FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClubMembership" ADD CONSTRAINT "ClubMembership_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ClubRosterYear
ALTER TABLE "ClubRosterYear" ADD CONSTRAINT "ClubRosterYear_clubId_fkey"
    FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClubRosterYear" ADD CONSTRAINT "ClubRosterYear_copiedFromYearId_fkey"
    FOREIGN KEY ("copiedFromYearId") REFERENCES "ClubRosterYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RosterMember
ALTER TABLE "RosterMember" ADD CONSTRAINT "RosterMember_clubRosterYearId_fkey"
    FOREIGN KEY ("clubRosterYearId") REFERENCES "ClubRosterYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- TltApplication
ALTER TABLE "TltApplication" ADD CONSTRAINT "TltApplication_rosterMemberId_fkey"
    FOREIGN KEY ("rosterMemberId") REFERENCES "RosterMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TltApplication" ADD CONSTRAINT "TltApplication_clubId_fkey"
    FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- TltRecommendation
ALTER TABLE "TltRecommendation" ADD CONSTRAINT "TltRecommendation_tltApplicationId_fkey"
    FOREIGN KEY ("tltApplicationId") REFERENCES "TltApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Nomination
ALTER TABLE "Nomination" ADD CONSTRAINT "Nomination_clubId_fkey"
    FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Nomination" ADD CONSTRAINT "Nomination_rosterMemberId_fkey"
    FOREIGN KEY ("rosterMemberId") REFERENCES "RosterMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- EventFormField (self-referencing hierarchy)
ALTER TABLE "EventFormField" ADD CONSTRAINT "EventFormField_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventFormField" ADD CONSTRAINT "EventFormField_parentFieldId_fkey"
    FOREIGN KEY ("parentFieldId") REFERENCES "EventFormField"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- EventRegistration
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_clubId_fkey"
    FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RegistrationAttendee
ALTER TABLE "RegistrationAttendee" ADD CONSTRAINT "RegistrationAttendee_eventRegistrationId_fkey"
    FOREIGN KEY ("eventRegistrationId") REFERENCES "EventRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RegistrationAttendee" ADD CONSTRAINT "RegistrationAttendee_rosterMemberId_fkey"
    FOREIGN KEY ("rosterMemberId") REFERENCES "RosterMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ClassRequirement
ALTER TABLE "ClassRequirement" ADD CONSTRAINT "ClassRequirement_classCatalogId_fkey"
    FOREIGN KEY ("classCatalogId") REFERENCES "ClassCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- EventClassOffering
ALTER TABLE "EventClassOffering" ADD CONSTRAINT "EventClassOffering_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventClassOffering" ADD CONSTRAINT "EventClassOffering_classCatalogId_fkey"
    FOREIGN KEY ("classCatalogId") REFERENCES "ClassCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventClassOffering" ADD CONSTRAINT "EventClassOffering_teacherUserId_fkey"
    FOREIGN KEY ("teacherUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ClassEnrollment
ALTER TABLE "ClassEnrollment" ADD CONSTRAINT "ClassEnrollment_eventClassOfferingId_fkey"
    FOREIGN KEY ("eventClassOfferingId") REFERENCES "EventClassOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassEnrollment" ADD CONSTRAINT "ClassEnrollment_rosterMemberId_fkey"
    FOREIGN KEY ("rosterMemberId") REFERENCES "RosterMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- MemberRequirement
ALTER TABLE "MemberRequirement" ADD CONSTRAINT "MemberRequirement_rosterMemberId_fkey"
    FOREIGN KEY ("rosterMemberId") REFERENCES "RosterMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- EventFormResponse
ALTER TABLE "EventFormResponse" ADD CONSTRAINT "EventFormResponse_eventRegistrationId_fkey"
    FOREIGN KEY ("eventRegistrationId") REFERENCES "EventRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventFormResponse" ADD CONSTRAINT "EventFormResponse_eventFormFieldId_fkey"
    FOREIGN KEY ("eventFormFieldId") REFERENCES "EventFormField"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventFormResponse" ADD CONSTRAINT "EventFormResponse_attendeeId_fkey"
    FOREIGN KEY ("attendeeId") REFERENCES "RosterMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- MonthlyReport
ALTER TABLE "MonthlyReport" ADD CONSTRAINT "MonthlyReport_clubId_fkey"
    FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- YearEndReport
ALTER TABLE "YearEndReport" ADD CONSTRAINT "YearEndReport_clubId_fkey"
    FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
