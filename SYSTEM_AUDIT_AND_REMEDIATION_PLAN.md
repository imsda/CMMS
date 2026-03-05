# CMMS System Audit and Remediation Plan
Date: 2026-03-05
Branch audited: codex/post-46-nav-email-fixes

## Executive Summary
The system is no longer in hard-fail startup mode, but end-to-end product workflows are still fragmented. The biggest issue is not one bug; it is a missing integration layer between pages, actions, and UX state handling.

Current status:
- Core auth, Prisma schema, migrations, and production boot are functioning.
- Role routing and baseline navigation now exist for all four roles.
- Event builder and invite flows still require UX hardening and stronger operational feedback.
- Admin information pages exist, but user/club management CRUD is incomplete.

## What Is Working
- Authentication/session role resolution and dashboard redirects.
- Docker + Prisma migrate deploy startup path.
- Admin/Director/Teacher/Student route shells with navigation.
- TLT recommendation token generation and public recommendation submission route.

## Critical Gaps (Prioritized)

### P0: Workflow Integrity
1. Event creation UX is fragile.
- Dynamic question builder relies on raw JSON entry for options.
- No drag/drop ordering or explicit move controls.
- Minimal inline error recovery when action validation fails.

2. Director registration flow discoverability is weak.
- Workflow spans multiple pages/actions but lacks a clear linear wizard.
- Error surfaces rely on thrown server errors instead of structured form state.

3. Action error handling is inconsistent.
- Many actions throw directly, which can produce abrupt runtime error pages.
- Should return typed result envelopes for expected user-input failures.

### P1: Administrative Completeness
4. Admin users/clubs pages are read-only.
- No create/edit/deactivate flows for users.
- No create/edit/merge/deactivate flows for clubs.
- No club membership management UI.

5. Missing system-level “setup” workflow.
- No guided flow for first-time bootstrapping (create clubs, assign directors, invite users).

### P1: Invite/Email Reliability
6. Invite/email tracking is not persisted.
- Recommendation links are created, but delivery status is not stored in DB.
- Failures are surfaced in redirect query params only.

7. Email templates and sender behavior are distributed.
- Registration and recommendation email behavior should be unified (same reliability/telemetry approach).

### P2: UX and Product Coherence
8. Dashboard data quality differs by role.
- Some dashboards are live-data, others are largely static placeholders.

9. CTA consistency issues remain.
- Some routes/pages are now wired, but there is no centralized route contract validation.

## Route + Navigation Audit Snapshot
Role shell status:
- SUPER_ADMIN: navigation present; dashboard, events, catalog, compliance, nominations, reports, storage, clubs, users.
- CLUB_DIRECTOR: navigation present; dashboard, events, roster, nominations, TLT, reports.
- STAFF_TEACHER: navigation present; dashboard (+ class pages from dashboard actions).
- STUDENT_PARENT: navigation present; dashboard.

Remaining structural limitation:
- Several features are read-only or action-first without full CRUD UX loops.

## Remediation Plan

### Wave 1 (P0) - Stabilize Core Workflows
Target: prevent user-facing dead-ends and crashes.

Deliverables:
1. Convert high-frequency actions to structured result pattern.
- Return `{ok, fieldErrors, formError}` instead of throwing for expected validation failures.
- Start with:
  - `createEventWithDynamicFields`
  - `saveEventRegistrationDraft`
  - `submitEventRegistration`
  - `generateTltRecommendationLinks`

2. Event builder UX rewrite.
- Replace freeform JSON options input with chip/list editor for MULTI_SELECT.
- Add explicit move up/down controls for question ordering.
- Add group/child visual hierarchy with deterministic submit order.
- Persist draft in client state and show actionable validation summary.

3. Director registration path hardening.
- Add a guided header stepper with explicit “Back to event list” and “Continue to classes”.
- Ensure all CTA transitions are reversible and state-safe.

Acceptance criteria:
- No uncaught error page from normal user mistakes in these flows.
- Event create succeeds with top-level + grouped fields + multi-select options.
- Director can complete registration draft + submit without hidden prerequisites.

### Wave 2 (P1) - Admin Management Completion
Target: make admin role operationally complete.

Deliverables:
1. Clubs CRUD.
- Create/edit/deactivate club.
- Club code uniqueness + type validation.

2. Users CRUD + role assignment.
- Create user, reset password flow, deactivate user.
- Assign/change primary club membership and role.

3. Membership management view.
- Matrix of user-to-club assignments with primary membership controls.

Acceptance criteria:
- Admin can onboard a new club and director entirely from UI.

### Wave 3 (P1) - Invite/Email Reliability Layer
Target: make outbound email auditable and supportable.

Deliverables:
1. Add persistent delivery fields/table.
- status (`PENDING`,`SENT`,`FAILED`), providerMessageId, lastError, sentAt.

2. Retry controls.
- Retry failed recommendation emails from Director UI.

3. Unified email service abstraction.
- Shared error handling, logging, and idempotency keys.

Acceptance criteria:
- Every generated invite has traceable send state.
- Directors can recover from partial send failures without regenerating all links.

### Wave 4 (P2) - UX Coherence + QA Automation
Target: make system predictable and production-safe.

Deliverables:
1. Standardized page-level status/empty/error components.
2. End-to-end tests for:
- auth role redirect matrix
- event create/edit
- registration draft/submit
- recommendation generate/send/submit
3. Route contract check in CI.
- Validate all static href targets resolve to known routes.

Acceptance criteria:
- No dead static links.
- CI catches workflow regressions before deploy.

## Immediate Next PR Scope Recommendation
Start Wave 1 with:
1. Event builder UX rewrite (remove raw options JSON and add ordered editor).
2. Structured server action results + inline error rendering on `/admin/events/new`.
3. Structured result handling for recommendation generation page.

## Risk Notes
- Existing schema is sufficient for Wave 1 and most of Wave 2.
- Wave 3 likely requires a migration for email delivery tracking.
- Avoid parallel large refactors; land by vertical workflow slices.
