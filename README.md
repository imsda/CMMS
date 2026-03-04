# Club Management & Camporee Scheduling Platform (CMMS)

CMMS is a conference-wide platform for managing club rosters, Camporee events, class enrollment, and reporting in one system. It is designed for four primary personas:

- **Conference Super Admins** (create events, build forms, manage honors, pull reports)
- **Club Directors** (maintain yearly roster, submit registrations, assign classes)
- **Teachers/Staff** (view class rosters and check in attendees)
- **Students/Parents** (reserved for future expansion)

---

## What the platform solves

Conference event workflows are often split across spreadsheets, paper forms, and ad-hoc communication. CMMS centralizes:

- Annual club roster rollover
- Event registration with dynamic custom fields
- Live class seat capacity management
- Medical and operational reporting for event staff
- Printable/exportable PDF registration packets

This provides a single source of truth from planning through event execution.

---

## Technology Stack

- **Next.js App Router** (server components + route segments)
- **TypeScript**
- **Prisma ORM** + **PostgreSQL**
- **NextAuth (Credentials provider)** for authentication and role-aware sessions
- **Tailwind CSS** for UI styling
- **React PDF (`@react-pdf/renderer`)** for registration packet output
- **Resend API integration** for optional registration receipt emails

---

## Next.js App Router architecture

CMMS uses route groups and role-based route segments to keep each persona’s workflows cleanly separated.

### Root and global concerns

- `app/layout.tsx` – root shell and global styling
- `app/page.tsx` – root landing/redirect behavior
- `app/(auth)/login/page.tsx` – sign-in screen
- `app/api/auth/[...nextauth]/route.ts` – NextAuth route handler

### Role-based application areas

- `app/admin/*` – super-admin dashboards and configuration
  - event creation/editing
  - reports (operational, medical)
  - honors/class catalog management
- `app/director/*` – club-director workflows
  - yearly roster management + rollover
  - event registration and dynamic form completion
  - class assignment board
- `app/teacher/*` – staff/teacher class roster operations
- `app/student/*` – student area scaffold

### Server actions and domain workflows

Server actions are organized under `app/actions/` and enforce role checks + business logic:

- `roster-actions.ts` – roster CRUD + yearly rollover
- `event-admin-actions.ts` – event creation + dynamic field persistence
- `event-registration-actions.ts` – director registration submission
- `enrollment-actions.ts` – class assignment and seat checks
- `report-actions.ts` / `medical-report-actions.ts` – report generation data
- `checkin-actions.ts` / `teacher-actions.ts` – event/class check-in flows

### Data and integration layers

- `lib/prisma.ts` – shared Prisma client singleton
- `lib/data/*` – report/export data assembly
- `lib/pdf/event-registration-pdf.tsx` – PDF template/rendering
- `lib/email/*` – optional registration receipt email integration

---

## Prisma database structure

The Prisma schema (`prisma/schema.prisma`) models identity, club roster lifecycle, events, forms, registrations, class offerings, and reporting relationships.

### 1) Identity, organizations, and access control

- **`User`**
  - Stores login identity, password hash, and role.
- **`Club`**
  - Conference club record (code, type, name, district, etc.).
- **`ClubMembership`**
  - Joins users to clubs, including primary membership behavior.

### 2) Yearly roster lifecycle

- **`ClubRosterYear`**
  - One club can have multiple roster years.
  - Tracks active year, date range, and optional lineage (`copiedFromYearId`).
- **`RosterMember`**
  - Member profile tied to a specific roster year.
  - Stores role, age, medical flags, dietary restrictions, emergency contacts, and background-check metadata.
- **`MemberRequirement`**
  - Tracks completed requirements/honors per member.

### 3) Event configuration and registration

- **`Event`**
  - Defines event timing, pricing, registration windows, and location.
- **`EventFormField`**
  - Dynamic form definition (including FIELD_GROUP parent/child hierarchy).
- **`EventRegistration`**
  - Club registration instance for an event with status + payment tracking.
- **`RegistrationAttendee`**
  - Connects roster members to the club’s event registration.
- **`EventFormResponse`**
  - Stores answers to dynamic form fields for a registration.

### 4) Honors/classes and enrollment

- **`ClassCatalog`**
  - Master conference honor/class catalog.
- **`ClassRequirement`**
  - Requirement rules for each catalog class (age, role, prerequisite honor, etc.).
- **`EventClassOffering`**
  - Event-specific offering of a class with assigned teacher and capacity.
- **`ClassEnrollment`**
  - Assignment of a registration attendee to a class offering.

### Key enums used throughout the system

- `UserRole`, `ClubType`, `MemberRole`, `Gender`
- `RolloverStatus`, `RegistrationStatus`, `PaymentStatus`
- `FormFieldType`, `ClassType`, `RequirementType`

---

## Core feature deep dive

### 1) Yearly Rollover (club lifecycle continuity)

Directors can create a new active roster year by copying active members from the previous year.

- Existing active roster year for the club is deactivated
- New year record is created with date boundaries
- Active members are copied with `rolloverStatus=CONTINUING`
- Historical year data remains intact for audits and trend tracking

**Result:** Clubs avoid retyping complete rosters every year while retaining history.

### 2) Dynamic Forms (event-specific questions)

Super Admins can define per-event questions with supported types:

- `SHORT_TEXT`
- `NUMBER`
- `MULTI_SELECT`
- `BOOLEAN`
- `ROSTER_SELECT`
- `ROSTER_MULTI_SELECT`
- `FIELD_GROUP` (for grouped question sections)

Directors complete these at registration time; answers are persisted and available for operational reporting.

**Result:** Conference can tailor data collection by event without code changes.

### 3) PDF Generation (registration packet export)

CMMS exposes a PDF export route that composes registration and attendee details into a printable packet.

- Built with React PDF
- Pulled from registration/export data layer
- Suitable for event operations, check-in desks, and archival records

**Result:** Staff can quickly produce standardized event packets.

### 4) Live Capacities (class enrollment control)

Class assignment is enforced server-side against current enrollment totals.

- Enrollment attempts validate capacity before write
- Directors see class boards with seat availability context
- Prevents over-assignment and conflicting spreadsheet-side counts

**Result:** More reliable class planning and reduced event-day corrections.

---

## Reporting capabilities

Admins can access event-level reports, including:

- **Operational reports** (club counts, attendee counts, logistics subsets)
- **Medical/dietary manifests** for kitchen and medical teams
- **CSV export options** for downstream analysis and staffing workflows

These reports are generated from submitted/approved registration data.

---

## Seeded baseline for new environments

`prisma/seed.ts` can initialize local/dev environments with:

- A default Super Admin
- A test club with an active roster year
- Sample honor/class catalog records and requirement patterns

Seed values can be overridden using environment variables.

---

## Project documentation map

- **Setup & local environment:** `SETUP.md`
- **Conference Super Admin guide:** `HOW-TO-Admin.md`
- **Club Director guide:** `HOW-TO-ClubDirector.md`
- **Legacy user walkthrough:** `USER_GUIDE.md`

