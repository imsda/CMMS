# Club Management & Camporee Scheduling Platform (CMMS)

CMMS is a conference-wide club management platform built for Pathfinder/Adventurer style ministries. It centralizes **yearly roster management**, **event registration**, and **class enrollment** workflows so administrators, club directors, and teachers can work from the same source of truth.

---

## Tech Stack

- **Next.js (App Router)** for the application framework and route-based UI organization.
- **TypeScript** for typed server actions, pages, and utility modules.
- **Prisma ORM** with a **PostgreSQL** datasource for schema management and query access.
- **Tailwind CSS** for utility-first styling.
- **NextAuth (Credentials provider)** for role-based authentication and session handling.
- **React-PDF (`@react-pdf/renderer`)** for generating downloadable event registration PDF exports.

---

## Core Features

### 1) Yearly Roster Rollover
Club Directors can run an annual rollover process to create a new active `ClubRosterYear` from a previous year. Members are copied forward and marked with rollover metadata so clubs can:

- Continue active members into the next year.
- Mark former members as archived or graduated in the source year.
- Preserve year-over-year historical records for audits and planning.

This workflow is backed by `ClubRosterYear`, `RosterMember`, and `RolloverStatus` relationships in the data model.

### 2) Live Class Capacities
During Camporee class enrollment, seat usage is enforced in real time using class offering capacity checks in enrollment actions:

- Clubs can enroll only attendees tied to their event registration.
- Capacity is validated server-side before creating an enrollment.
- UI surfaces seats-left counters to support fast decisions during registration windows.

This feature is modeled around `EventClassOffering.capacity`, `waitlistCapacity`, and `ClassEnrollment` counts.

### 3) Event Registration + Dynamic Questions
Conference admins can define custom event-specific form fields (text, date, select, etc.). Club Directors then complete these forms while submitting attendee selections.

- Dynamic field definitions are stored in `EventFormField`.
- Answers are stored in `EventFormResponse`.
- Club registration lifecycle is tracked with `EventRegistration.status`.

### 4) Role-Based Experience
The platform supports role-specific dashboards and actions:

- **SUPER_ADMIN**: Event and catalog administration.
- **CLUB_DIRECTOR**: Roster, event registration, and class assignment workflows.
- **STAFF_TEACHER**: Teaching roster and check-in tools.
- **STUDENT_PARENT**: Reserved for future expansion.

---

## High-Level Architecture

- **App routes** under `app/` provide role-specific layouts and pages.
- **Server actions** under `app/actions/` encapsulate domain workflows (roster rollover, registration, enrollment).
- **`lib/prisma.ts`** provides a shared Prisma client.
- **`prisma/schema.prisma`** defines the canonical domain model.
- **`prisma/seed.ts`** initializes baseline data (super admin, test club, sample honors).
- **API export route** renders registration payloads into PDF via React-PDF.

---

## Database Structure (Prisma Overview)

### Identity and Access
- `User`
- `Club`
- `ClubMembership`

### Club Year & Roster Lifecycle
- `ClubRosterYear`
- `RosterMember`
- `MemberRequirement`

### Events and Registrations
- `Event`
- `EventFormField`
- `EventRegistration`
- `RegistrationAttendee`
- `EventFormResponse`

### Class Catalog and Enrollment
- `ClassCatalog`
- `ClassRequirement`
- `EventClassOffering`
- `ClassEnrollment`

### Key Enums
- `UserRole`, `ClubType`, `MemberRole`, `Gender`
- `RolloverStatus`, `RegistrationStatus`
- `FormFieldType`, `ClassType`, `RequirementType`

---

## Project Workflows at a Glance

1. Admin seeds and configures the system.
2. Club Director maintains the current year roster and runs yearly rollover.
3. Admin creates Camporee events and dynamic forms.
4. Club Director submits event registrations and attendee selections.
5. Club Director assigns attendees to class offerings with live capacity visibility.
6. Teacher views class roster and tracks attendance/check-ins.
7. Admin exports registration packets as PDFs for event operations.

---

## Documentation Index

- Setup and local environment instructions: **`SETUP.md`**
- Director-focused usage walkthrough: **`USER_GUIDE.md`**

