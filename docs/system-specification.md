# CMMS System Specification

This is the source-of-truth reference for the CMMS codebase. All AI development prompts should reference this document first to prevent rebuilding features that already exist.

**Last updated:** 2026-03-13

---

## 1. Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 15.5.10 |
| Language | TypeScript | 5.8.2 |
| UI | React + Tailwind CSS | 18.2.0 / 3.4.17 |
| Database | PostgreSQL + Prisma ORM | Prisma 5.22.0 |
| Auth | NextAuth v5 (Credentials, JWT) | 5.0.0-beta.30 |
| PDF | @react-pdf/renderer | 4.3.1 |
| Email | Resend API | Custom integration |
| i18n | next-intl | 3.26.4 |
| Security | bcryptjs | 2.4.3 |
| Node | LTS required | >= 20 |

---

## 1.1 Architectural Guardrails

Future work should extend existing CMMS systems with these rules:

- Every server action should call `auth()` and verify `session.user.role`
- Director-scoped features should use `getManagedClubContext()` from `lib/club-management.ts`
- `SUPER_ADMIN` should be allowed into teacher and director workflows through explicit admin-safe paths rather than weakened non-admin role checks
- Mutations should call `revalidatePath()`
- Year-scoped club data should attach to `ClubRosterYear`
- Capacity-sensitive enrollment behavior should stay inside serializable transactions
- New features should add tests under `tests/`
- Prefer extending existing models over creating duplicates

These guardrails are especially important for AI-assisted implementation.

---

## 2. Model Inventory

### Identity & Access Control

| Model | Purpose | Key Fields | Relations |
|---|---|---|---|
| `User` | Login identity | email (unique), name, role, passwordHash | memberships, taughtOfferings, rosterMemberLinks, eventsCreated |
| `Club` | Conference club record | code (unique), name, type, city, state | rosterYears, registrations, monthlyReports, yearEndReports, nominations, tltApplications, complianceSyncRuns |
| `ClubMembership` | User-to-club link | clubId, userId, title, isPrimary | Unique on (clubId, userId) |

### Roster & Membership

| Model | Purpose | Key Fields | Relations |
|---|---|---|---|
| `ClubRosterYear` | Yearly roster snapshot | clubId, yearLabel, startsOn, endsOn, isActive, copiedFromYearId | members, complianceSyncRuns. Unique on (clubId, yearLabel) |
| `ClubActivity` | Logged club activity source for reporting | clubRosterYearId, activityDate, title, pathfinderAttendance, staffAttendance, uniformCompliance | Belongs to `ClubRosterYear` and feeds monthly report auto-fill |
| `RosterMember` | Individual member (70+ fields) | firstName, lastName, dateOfBirth, ageAtStart, gender, memberRole, medicalFlags, dietaryRestrictions, backgroundCheckDate/Cleared, photoReleaseConsent, medicalTreatmentConsent, membershipAgreementConsent, insuranceCardFilename, rolloverStatus, isActive | registrations, classEnrollments, completedRequirements, eventFormResponses, nominations, tltApplication, portalUsers |
| `UserRosterMemberLink` | Student portal access | userId, rosterMemberId | Unique on (userId, rosterMemberId) |

### TLT & Nominations

| Model | Purpose | Key Fields | Relations |
|---|---|---|---|
| `TltApplication` | TLT application | rosterMemberId (unique), clubId, grade, citizenship, isBaptized, tltYearWorkingOn, classesCompleted (JSON), tShirtSize, poloSize, status | recommendations |
| `TltRecommendation` | Reference recommendation | tltApplicationId, secureToken (unique), recommenderName/Email, relationship, qualities, stressResponse, status, inviteEmailStatus | |
| `Nomination` | Award nomination | clubId, rosterMemberId, awardType, year, justificationText, communityServiceDetails, status | |

### Event Management

| Model | Purpose | Key Fields | Relations |
|---|---|---|---|
| `Event` | Event master | name, slug (unique), startsAt, endsAt, registrationOpensAt/ClosesAt, basePrice, lateFeePrice, lateFeeStartsAt, locationName/Address, createdByUserId | dynamicFields, registrations, classOfferings, createdBy |
| `EventTemplate` | Reusable event blueprint | name, description, isActive, snapshot (JSON), createdByUserId | Created events remain editable and independent after template apply |
| `EventFormField` | Dynamic form question | eventId, parentFieldId, key, label, type, fieldScope (GLOBAL/ATTENDEE), options (JSON), isRequired, sortOrder | childFields, responses. Unique on (eventId, key) |
| `EventRegistration` | Club registration | eventId, clubId, registrationCode (unique), status, totalDue, amountPaid, paymentStatus | attendees, formResponses. Unique on (eventId, clubId) |
| `RegistrationAttendee` | Attendee link | eventRegistrationId, rosterMemberId, checkedInAt | Unique on (registrationId, memberId) |
| `EventFormResponse` | Form answer | eventRegistrationId, eventFormFieldId, attendeeId (null=GLOBAL), value (JSON) | Unique on (registrationId, fieldId, attendeeId) |
| `CamporeeScore` | Additive Camporee competition scoring | eventId, eventRegistrationId, category, score, createdByUserId | Extends existing event registrations rather than creating a separate Camporee registration system |

### Classes & Enrollment

| Model | Purpose | Key Fields | Relations |
|---|---|---|---|
| `ClassCatalog` | Master class/honor definition | title, code (unique), description, classType (HONOR/SPECIALTY/WORKSHOP/REQUIRED), active | requirements, offerings |
| `ClassRequirement` | Eligibility rule | classCatalogId, requirementType (MIN_AGE/MAX_AGE/MEMBER_ROLE/COMPLETED_HONOR/MASTER_GUIDE), config (JSON) | |
| `EventClassOffering` | Per-event class instance | eventId, classCatalogId, teacherUserId, capacity | enrollments. Unique on (eventId, classCatalogId) |
| `ClassEnrollment` | Member enrollment | eventClassOfferingId, rosterMemberId, assignedAt, attendedAt | Unique on (offeringId, memberId) |
| `MemberRequirement` | Completed requirement | userId, rosterMemberId, requirementType, metadata (JSON), completedAt | |

### Reporting

| Model | Purpose | Key Fields | Relations |
|---|---|---|---|
| `MonthlyReport` | Monthly club metrics | clubId, reportMonth, meetingCount, averagePathfinderAttendance, averageStaffAttendance, uniformCompliance, pointsCalculated, status | Unique on (clubId, reportMonth). Submission should only proceed when the month is covered by a roster year |
| `YearEndReport` | Annual completions | clubId, reportYear, friendCompletions, companionCompletions, explorerCompletions, rangerCompletions, voyagerCompletions, guideCompletions, status | Unique on (clubId, reportYear). Remains club/year keyed in this pass; no direct roster-year FK yet |

### Compliance & System

| Model | Purpose | Key Fields | Relations |
|---|---|---|---|
| `ComplianceSyncRun` | Sterling CSV sync audit | uploadedByUserId, appliedByUserId, scope, clubId, clubRosterYearId, fileName, status, processedRows, passedRows, updateCount, skippedCount, ambiguousCount, rowResults (JSON), appliedAt | |
| `AuditLog` | Sensitive operational audit trail | actorUserId, actorRole, action, targetType, targetId, clubId, clubRosterYearId, summary, metadata | Best-effort logging for sensitive workflows |
| `ScheduledJobRun` | Scheduled job idempotency and status | jobKey, scopeKey, runDate, status, summary, metadata, completedAt | Tracks cron/API-triggered maintenance and reminders |
| `AuthRateLimitBucket` | Login throttling | keyHash (PK), scopeType (EMAIL_IP/IP), attemptCount, windowStartedAt, blockedUntil | |

### Enums

| Enum | Values |
|---|---|
| `UserRole` | SUPER_ADMIN, CLUB_DIRECTOR, STAFF_TEACHER, STUDENT_PARENT |
| `ClubType` | PATHFINDER, ADVENTURER, EAGER_BEAVER |
| `MemberRole` | PATHFINDER, ADVENTURER, TLT, STAFF, CHILD, DIRECTOR, COUNSELOR |
| `Gender` | MALE, FEMALE, NON_BINARY, PREFER_NOT_TO_SAY |
| `RolloverStatus` | CONTINUING, ARCHIVED, GRADUATED, NEW |
| `RegistrationStatus` | DRAFT, SUBMITTED, APPROVED, REJECTED |
| `PaymentStatus` | PENDING, PARTIAL, PAID |
| `FormFieldType` | SHORT_TEXT, LONG_TEXT, NUMBER, BOOLEAN, DATE, SINGLE_SELECT, MULTI_SELECT, ROSTER_SELECT, ROSTER_MULTI_SELECT, FIELD_GROUP |
| `FormFieldScope` | GLOBAL, ATTENDEE |
| `ClassType` | HONOR, SPECIALTY, WORKSHOP, REQUIRED |
| `RequirementType` | MIN_AGE, MAX_AGE, MEMBER_ROLE, COMPLETED_HONOR, MASTER_GUIDE |
| `ReportStatus` | DRAFT, SUBMITTED |
| `NominationStatus` | SUBMITTED, REVIEWED, WINNER |
| `TltApplicationStatus` | PENDING, APPROVED, REJECTED |
| `TltRecommendationStatus` | PENDING, COMPLETED |
| `ComplianceSyncRunStatus` | PREVIEW, APPLIED |
| `ComplianceSyncScope` | ROSTER_YEAR, SYSTEM_WIDE |
| `AuthRateLimitScope` | EMAIL_IP, IP |

---

## 3. Server Action Inventory

### `app/actions/admin-actions.ts` (1,086 LOC)
- `getAdminDashboardOverview()` — dashboard stats (clubs, members, events)
- `getAdminEventsIndexData()` — event list for admin
- `getMasterCatalogData()` — class catalog listing
- `createMasterCatalogItem(formData)` — add class to catalog
- `updateMasterCatalogItem(formData)` — edit catalog entry
- `importMasterCatalogCsv(formData)` — bulk CSV import
- `getAdminEventRegistrations(eventId)` — all registrations for event
- `getMasterEventAttendeesCsv(eventId)` — attendee export
- `createEventClassOfferingAction(formData)` — add class to event
- `updateEventClassOfferingAction(formData)` — edit offering
- `removeEventClassOfferingAction(formData)` — remove offering
- `clearEventClassOfferingEnrollmentsAction(formData)` — clear enrollments
- `getEventPatchOrderReport(eventId)` — patch order report
- `getEventPatchOrderCsv(eventId)` — patch order CSV export

### `app/actions/admin-management-actions.ts` (679 LOC)
- `createClubAction(...)` — create club
- `updateClubAction(...)` — update club
- `createUserAction(...)` — create user with password
- `updateUserProfileAction(...)` — update user profile
- `assignUserMembershipAction(...)` — add user to club
- `setPrimaryMembershipAction(...)` — set primary club
- `removeUserMembershipAction(...)` — remove membership
- `resetUserPasswordAction(...)` — reset password
- `assignStudentPortalLinkAction(...)` — link user to student
- `removeStudentPortalLinkAction(...)` — remove link
- `assignStudentPortalLink(userId, rosterMemberId)` — direct link
- `removeStudentPortalLink(linkId)` — direct remove

### `app/actions/event-admin-actions.ts` (607 LOC)
- `createEventWithDynamicFields(...)` — create event + form fields
- `saveEventTemplate(...)` — save or update reusable event template snapshots
- `toggleEventTemplateActive(formData)` — activate/deactivate a template
- `updateEventCoreDetails(...)` — update event metadata
- `updateEventDynamicFields(...)` — update form fields

### `app/actions/event-registration-actions.ts` (560 LOC)
- `persistRegistrationForClub(input)` — save registration data
- `saveEventRegistrationDraft(...)` — save as draft
- `submitEventRegistration(...)` — submit registration (DRAFT → SUBMITTED)

### `app/actions/roster-actions.ts` (391 LOC)
- `saveRosterMember(formData)` — create/update member
- `createRosterYear(yearLabel, clubIdOverride?)` — new roster year
- `executeYearlyRollover(...)` — copy members to new year

### `app/actions/enrollment-actions.ts` (344 LOC)
- `enrollAttendeeInClass(input)` — enroll (admin)
- `removeAttendeeFromClass(input)` — remove (admin)
- `bulkEnrollAttendeesInClass(input)` — bulk enroll using existing prerequisite/conflict/capacity rules
- `bulkRemoveAttendeesFromClass(input)` — bulk remove from an offering

### `app/actions/compliance-actions.ts` (480 LOC)
- `previewSterlingBackgroundChecks(...)` — parse CSV, preview matches
- `applySterlingBackgroundChecksPreview(...)` — apply preview results

### `app/actions/camporee-actions.ts`
- `getCamporeeDashboardData(eventId)` — admin Camporee scoring dashboard
- `saveCamporeeScore(formData)` — save additive scoring by category
- `getDirectorCamporeeSummary(eventId, clubIdOverride?)` — director score summary for the club registration

### `app/actions/tlt-recommendation-actions.ts` (454 LOC)
- `generateTltRecommendationLinks(...)` — create recommendation links
- `submitPublicTltRecommendation(formData)` — public submission
- `retryTltRecommendationInviteEmail(formData)` — retry single email
- `retryFailedTltRecommendationInviteEmails(formData)` — retry all failed

### `app/actions/report-actions.ts` (303 LOC)
- `getOperationalReports(eventId)` — spiritual/duty/AV report data
- `getOperationalSpiritualCsv(eventId)` — spiritual CSV
- `getOperationalDutyCsv(eventId)` — duty CSV
- `getOperationalAvCsv(eventId)` — AV CSV

### `app/actions/club-report-actions.ts`
- `createMonthlyReport(formData)` — create/update monthly report
- `saveClubActivity(formData)` — create/update club activity entry
- `deleteClubActivity(formData)` — delete club activity entry
- `getDirectorReportsDashboardData(clubIdOverride?)` — director view
- `getAdminReportsData(sortBy, direction)` — admin view

### `app/actions/checkin-actions.ts`
- `getEventCheckinDashboard(eventId)` — checkin overview
- `markRegistrationCheckedIn(formData)` — mark checked in
- `approveRegistrationForCheckIn(eventId, registrationId)` — approve

### `app/actions/nomination-actions.ts`
- `getDirectorNominationPageData(clubIdOverride?)` — director view
- `submitNomination(formData)` — submit nomination
- `getAdminNominations()` — admin view
- `updateNominationStatus(formData)` — approve/reject

### `app/actions/teacher-actions.ts`
- `updateClassAttendance(input)` — mark attendance
- `bulkUpdateClassAttendance(input)` — bulk attendance update
- `signOffRequirementsForStudents(input)` — sign off completion

### `app/actions/tlt-actions.ts`
- `saveTltApplication(formData)` — save TLT application

### `app/actions/medical-report-actions.ts`
- `getMedicalManifest(eventId)` — medical/dietary report

### `app/actions/storage-actions.ts`
- `purgeInactiveInsuranceCards()` — cleanup orphaned files

### Cross-Cutting Patterns
- Director-scoped actions should follow `lib/club-management.ts`
- Reporting flows should reuse `app/actions/club-report-actions.ts`
- Event/admin creation flows should reuse `app/actions/event-admin-actions.ts`
- Registration flows should reuse `app/actions/event-registration-actions.ts`
- Enrollment flows should reuse `app/actions/enrollment-actions.ts`
- Compliance flows should reuse `app/actions/compliance-actions.ts`

---

## 4. Feature Status Matrix

| Feature | Status | Models | Key Files |
|---|---|---|---|
| User authentication | Built | User, AuthRateLimitBucket | `auth.ts`, `lib/auth-rate-limit.ts` |
| Club management | Built | Club, ClubMembership | `app/actions/admin-management-actions.ts` |
| Roster management | Built | ClubRosterYear, RosterMember | `app/actions/roster-actions.ts` |
| Yearly rollover | Built | ClubRosterYear (copiedFromYearId) | `roster-actions.ts:executeYearlyRollover` |
| Medical data encryption | Built | RosterMember (encrypted fields) | `lib/medical-data.ts`, `lib/encryption.ts` |
| Event creation | Built | Event, EventFormField | `app/actions/event-admin-actions.ts` |
| Dynamic form fields | Built | EventFormField (10 types, 2 scopes) | `lib/event-form-*.ts` |
| Event registration | Built | EventRegistration, RegistrationAttendee, EventFormResponse | `app/actions/event-registration-actions.ts` |
| Registration lifecycle | Built | RegistrationStatus enum | `lib/registration-lifecycle.ts` |
| Check-in system | Built | EventRegistration (approvedAt), RegistrationAttendee (checkedInAt) | `app/actions/checkin-actions.ts` |
| Class catalog | Built | ClassCatalog, ClassRequirement | `app/actions/admin-actions.ts` |
| Class enrollment | Built | EventClassOffering, ClassEnrollment | `app/actions/enrollment-actions.ts` |
| Prerequisites | Built | ClassRequirement (5 types) | `lib/class-prerequisite-utils.ts` |
| Seat capacity | Built | EventClassOffering.capacity | `lib/class-model.ts` |
| Teacher roster | Built | EventClassOffering (teacherUserId) | `app/actions/teacher-actions.ts` |
| Monthly reports | Built | MonthlyReport | `app/actions/club-report-actions.ts` |
| Year-end reports | Built | YearEndReport | `app/actions/club-report-actions.ts` |
| Operational reports | Built | EventFormResponse (aggregation) | `app/actions/report-actions.ts` |
| Medical reports | Built | RosterMember (medical fields) | `app/actions/medical-report-actions.ts` |
| Compliance sync | Built | ComplianceSyncRun | `lib/compliance-sync.ts`, `app/actions/compliance-actions.ts` |
| TLT applications | Built | TltApplication | `app/actions/tlt-actions.ts` |
| TLT recommendations | Built | TltRecommendation | `app/actions/tlt-recommendation-actions.ts` |
| Nominations | Built | Nomination | `app/actions/nomination-actions.ts` |
| Student portal | Built | UserRosterMemberLink | `lib/student-portal-links.ts` |
| PDF export | Built | — | `lib/pdf/`, `app/api/events/[eventId]/export/` |
| Email integration | Built | — | `lib/email/` |
| i18n | Built | — | `messages/`, next-intl |
| Rate-limited login | Built | AuthRateLimitBucket | `lib/auth-rate-limit.ts` |
| File storage | Built | — | `app/actions/storage-actions.ts`, `app/api/secure-files/` |
| Club activity logging | Built | ClubActivity | `app/actions/club-report-actions.ts`, `lib/data/club-activity.ts` |
| Meeting attendance tracking | Partial | ClubActivity (aggregate attendance totals) | `app/director/reports/page.tsx` |
| Report auto-fill from activities | Built | ClubActivity, MonthlyReport | `lib/club-activity.ts`, `app/actions/club-report-actions.ts` |
| Event templates | Built | EventTemplate | `app/actions/event-admin-actions.ts`, `lib/event-templates.ts` |
| Camporee module registration | Built | EventFormField, EventRegistration, EventFormResponse | `app/director/events/[eventId]/_components/registration-form-fulfiller.tsx` |
| Camporee scoring | Built | CamporeeScore | `app/actions/camporee-actions.ts`, `app/admin/events/[eventId]/camporee/page.tsx` |
| Honors UI enhancements | Built | EventClassOffering, ClassEnrollment | `app/actions/enrollment-actions.ts`, `app/actions/teacher-actions.ts` |
| Audit logging | Built | AuditLog | `lib/audit-log.ts`, `app/admin/audit/page.tsx` |
| Scheduled jobs / cron | Built | ScheduledJobRun | `lib/scheduled-jobs.ts`, `app/api/jobs/run/route.ts` |
| **Payment processor integration** | **Missing** | — | — |
| **Error monitoring (Sentry etc.)** | **Missing** | — | — |
| **Background check expiration tracking** | **Missing** | — | — |
| Compliance dashboard (visual) | Built | ComplianceSyncRun | `app/admin/compliance/page.tsx`, `lib/compliance-dashboard.ts` |
| **Admin analytics dashboard** | **Partial** | — | `app/admin/dashboard/page.tsx` (basic stats only) |

---

## 5. Architectural Patterns

### 5.1 Role-Based Authorization
Every server action calls `auth()` and checks `session.user.role` before proceeding.
- SUPER_ADMIN: full access
- CLUB_DIRECTOR: scoped to primary club via `getManagedClubContext()` (in `lib/club-management.ts`)
- STAFF_TEACHER: scoped to assigned class offerings
- STUDENT_PARENT: scoped to linked roster members via `UserRosterMemberLink`

Teacher and director surfaces preserve their existing non-admin restrictions while allowing `SUPER_ADMIN` to enter those workflows explicitly. Director workflows remain club-scoped through selected `clubId` context, and teacher workflows allow administrative oversight without pretending the admin is the assigned teacher.

### 5.2 Year-Scoped Data
All member data is scoped to `ClubRosterYear`, not directly to `Club`. This preserves historical data across yearly rollovers. New features must follow this pattern.

### 5.3 Serializable Transactions
Class enrollment uses `Prisma.$transaction` with `isolationLevel: Serializable` to prevent race conditions on seat capacity. Includes retry logic on `P2034` conflicts.

### 5.4 Medical Data Encryption
Sensitive fields (medicalFlags, dietaryRestrictions, insurance, lastTetanusDate) are encrypted at rest using AES via `lib/encryption.ts`. Format: `base64:iv:salt`. Decrypted on read via `decryptMedicalFields()`.

### 5.5 Registration Lifecycle State Machine
- Registration window: NOT_OPEN → OPEN → CLOSED (based on dates)
- Registration status: DRAFT (editable) → SUBMITTED (locked) → APPROVED (fully locked)
- Defined in `lib/registration-lifecycle.ts`

### 5.6 Dynamic Form Field System
- 10 field types including FIELD_GROUP for hierarchical grouping
- Two scopes: GLOBAL (one answer per registration) and ATTENDEE (one answer per attendee)
- Field `options` also support conditional visibility rules for guided module-based registration flows
- Completeness checking via `getMissingRequiredFieldLabels()` in `lib/event-form-completeness.ts`

### 5.7 Server Action Pattern
```
"use server";
import { auth } from "../../auth";

export async function myAction(input) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    throw new Error("Unauthorized");
  }
  // ... Prisma query ...
  revalidatePath("/admin/...");
  return result;
}
```

### 5.8 System Health Checks
`lib/system-health.ts` runs at startup and checks:
- Pending Prisma migrations (hard fail)
- Medical encryption consistency
- Rate limit bucket staleness

---

## 6. Test Coverage Map

| Test File | What It Tests | Type |
|---|---|---|
| `auth-rate-limit.test.ts` | Rate limit bucket evaluation logic | Unit |
| `auth-rate-limit.integration.test.ts` | Rate limit persistence | Integration |
| `class-model.test.ts` | Seat calculation, enrollment conflict detection | Unit |
| `class-enrollment.integration.test.ts` | Live capacity enforcement | Integration |
| `club-activity.test.ts` | Activity auto-fill calculations | Unit |
| `club-activity.integration.test.ts` | Activity/report persistence | Integration |
| `compliance-sync.test.ts` | CSV parsing, row matching | Unit |
| `compliance-dashboard.test.ts` | Derived compliance dashboard summaries | Unit |
| `compliance.integration.test.ts` | Full compliance sync workflow | Integration |
| `director-dashboard-health.test.ts` | Derived readiness cards | Unit |
| `event-form-completeness.test.ts` | Required field validation logic | Unit |
| `event-form-config.test.ts` | Conditional visibility configuration | Unit |
| `event-form-responses.test.ts` | Form response parsing, value checking | Unit |
| `event-templates.test.ts` | Template snapshot and validation | Unit |
| `event-templates.integration.test.ts` | Template-to-event creation flow | Integration |
| `camporee.test.ts` | Camporee standings logic | Unit |
| `camporee.integration.test.ts` | Camporee scoring snapshot | Integration |
| `honors-ui.test.ts` | Honors filtering and bulk-selection helpers | Unit |
| `honors-bulk.integration.test.ts` | Bulk honors enrollment behavior | Integration |
| `audit-log.test.ts` | Audit metadata sanitization | Unit |
| `medical-data.test.ts` | Encryption/decryption utilities | Unit |
| `registration-lifecycle.test.ts` | Registration window state machine | Unit |
| `registration.integration.test.ts` | Registration submission end-to-end | Integration |
| `checkin.integration.test.ts` | Check-in approval workflow | Integration |
| `scheduled-jobs.test.ts` | Scheduled-job auth and parsing | Unit |
| `scheduled-jobs.integration.test.ts` | Scheduled-job idempotency | Integration |
| `required-migrations.test.ts` | Startup migration list parity | Unit |
| `student-portal-links.test.ts` | User-to-roster-member linking logic | Unit |
| `student-portal.test.ts` | Portal visibility rules | Unit |
| `student-portal-link.integration.test.ts` | Link creation and access | Integration |
| `integration-helpers.ts` | Shared test utilities (DB setup/teardown) | Helper |

**Test framework:** Node.js built-in `test` module with `assert/strict`

---

## 7. UI Route Map

### Admin (`/admin`) — SUPER_ADMIN only
| Route | Purpose |
|---|---|
| `/admin/dashboard` | Overview: club/member/event stats, system health |
| `/admin/events` | Event list |
| `/admin/events/new` | Create event + dynamic form builder |
| `/admin/events/[eventId]` | Event overview |
| `/admin/events/[eventId]/camporee` | Camporee scoring over existing registrations |
| `/admin/events/[eventId]/edit` | Edit event + dynamic fields |
| `/admin/events/[eventId]/classes` | Class offerings, teacher assignment |
| `/admin/events/[eventId]/checkin` | Check-in / registration approval |
| `/admin/events/[eventId]/reports/operational` | Spiritual/duty/AV reports |
| `/admin/events/[eventId]/reports/medical` | Medical/dietary manifests |
| `/admin/events/[eventId]/reports/compliance` | Background check status |
| `/admin/events/[eventId]/reports/patches` | Patch order report |
| `/admin/catalog` | Class/honor master catalog |
| `/admin/clubs` | Club directory |
| `/admin/users` | User management, portal links |
| `/admin/nominations` | Award nominations review |
| `/admin/compliance` | Sterling CSV sync workflow |
| `/admin/audit` | Audit log review |
| `/admin/reports` | Conference-wide report view |
| `/admin/storage` | Secure file management |

### Director (`/director`) — CLUB_DIRECTOR only
| Route | Purpose |
|---|---|
| `/director/dashboard` | Club dashboard, readiness, compliance, and activity health |
| `/director/roster` | Member management, yearly rollover |
| `/director/events` | Available events |
| `/director/events/[eventId]` | Registration form with grouped sections and Camporee summary |
| `/director/events/[eventId]/classes` | Class assignment board |
| `/director/nominations` | Submit nominations |
| `/director/tlt` | TLT application list |
| `/director/tlt/apply/[memberId]` | TLT application form |
| `/director/tlt/[applicationId]/recommendations` | Recommendation tracking |
| `/director/reports` | Monthly/year-end reports |

### Teacher (`/teacher`) — STAFF_TEACHER only
| Route | Purpose |
|---|---|
| `/teacher/dashboard` | Assigned classes overview |
| `/teacher/class/[offeringId]` | Class roster, attendance marking |

### Student (`/student`) — STUDENT_PARENT only
| Route | Purpose |
|---|---|
| `/student/dashboard` | Linked students, class assignments |

### Public (unauthenticated)
| Route | Purpose |
|---|---|
| `/login` | Login form |
| `/recommendation/[token]` | TLT recommendation submission |

### API
| Route | Purpose |
|---|---|
| `/api/events/[eventId]/export/[clubId]` | Registration PDF export |
| `/api/secure-files/[filename]` | Authorized private-file access |
| `/api/jobs/run` | Authorized scheduled-job execution |

---

## 8. Integration Points

| Integration | Technology | Files |
|---|---|---|
| Email | Resend API | `lib/email/resend.ts`, `lib/email/templates/` |
| PDF Export | @react-pdf/renderer | `lib/pdf/`, `app/api/events/[eventId]/export/[clubId]/route.ts` |
| Background Checks | Sterling Volunteers CSV | `lib/compliance-sync.ts`, `app/actions/compliance-actions.ts` |
| Secure Files | Local filesystem | `app/actions/storage-actions.ts`, `app/api/secure-files/[filename]/route.ts` |
| i18n | next-intl | `messages/en.json`, `messages/es.json` (if present) |

---

## 9. Key Scripts

| Script | Command | Purpose |
|---|---|---|
| Dev server | `npm run dev` | Development |
| Build | `npm run build` | Production build |
| Lint | `npm run lint` | ESLint (0 warnings policy) |
| Typecheck | `npm run typecheck` | TypeScript + Next.js generation |
| Test | `npm test` | Run all tests |
| Verify | `npm run verify` | typecheck + lint + test + build |
| Startup check | `npm run check:startup` | Production readiness |
| Scheduled jobs | `npm run schedule:jobs` | Manual scheduled-job runner |
| AI phase helper | `bash scripts/ai/run-phase.sh <task>` | Print phase workflow context |
| AI verify helper | `bash scripts/ai/verify-phase.sh` | Phase verification wrapper |
| AI summarize helper | `bash scripts/ai/summarize-phase.sh` | Diff summary + checklist |

---

## 10. Workflow Documents

- `docs/revised-build-plan.md` — phased delivery sequence
- `docs/build-plan-review.md` — audit context for extension-over-rebuild planning
- `docs/ai-development-prompts.md` — Codex prompting guardrails
- `docs/AI-WORKFLOW.md` — planner workflow and required human review
- `docs/SCHEDULED-JOBS.md` — Phase 8 runtime and deployment guidance
