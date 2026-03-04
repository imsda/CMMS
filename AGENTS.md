# AGENTS.md

## Session Summary
This file records the full set of technical changes completed in this working session to stabilize production builds for a Next.js 14 / React 18 / Prisma 5 application targeting Docker/xCloud.

## Scope Completed

### 1. React 18 Enforcement
- Replaced `useActionState` usage with React 18-compatible form APIs.
- Updated compliance admin page to use `useFormState` and `useFormStatus`.

File updated:
- `app/admin/compliance/page.tsx`

### 2. Hook Directive Check
- Audited hook-using client components and confirmed `"use client";` is present as first line where required.

### 3. Auth and Session Typing Stability
- Fixed NextAuth credential parsing (`credentials` unknown typing in v5).
- Aligned JWT/session callbacks to pass through `id`, `role`, and `clubId`.
- Removed duplicate module augmentation from `auth.ts` to avoid declaration collisions and kept augmentation in `types/next-auth.d.ts`.

Files updated:
- `auth.ts`
- `types/next-auth.d.ts`

### 4. Middleware Matcher Hardening
- Updated matcher to exclude static/system paths per production requirement.

File updated:
- `middleware.ts`

### 5. Prisma Schema and Relation Drift Fixes
- Added missing back-relation on `RosterMember` for event form responses.
- Added missing opposite relation in `MemberRequirement` for roster-member linkage.

Schema changes:
- Added `RosterMember.eventFormResponses EventFormResponse[]`
- Added `MemberRequirement.rosterMemberId String?`
- Added relation `MemberRequirement.rosterMember RosterMember?`
- Added index `@@index([rosterMemberId, requirementType])`

File updated:
- `prisma/schema.prisma`

### 6. Action Layer Full Alignment (`app/actions/*`)
All server actions were audited/regenerated and aligned with schema field names. Major corrections:

- `EventClassOffering` teacher field standardized to `teacherUserId`.
- `ClassRequirement` now handled through `config` JSON (not legacy flat columns).
- `MemberRequirement` now uses `requirementType` + `metadata` with optional `rosterMemberId`.
- JSON fields (especially event form options/config metadata) now parsed/typed without `any`.

Files updated:
- `app/actions/admin-actions.ts`
- `app/actions/checkin-actions.ts`
- `app/actions/club-report-actions.ts`
- `app/actions/compliance-actions.ts`
- `app/actions/enrollment-actions.ts`
- `app/actions/event-admin-actions.ts`
- `app/actions/event-registration-actions.ts`
- `app/actions/medical-report-actions.ts`
- `app/actions/nomination-actions.ts`
- `app/actions/report-actions.ts`
- `app/actions/roster-actions.ts`
- `app/actions/storage-actions.ts`
- `app/actions/teacher-actions.ts`
- `app/actions/tlt-actions.ts`
- `app/actions/tlt-recommendation-actions.ts`

### 7. Non-Action Drift Cleanup (Pages/Lib)
Additional build blockers outside `app/actions` were fixed:

- Updated teacher/director views to remove legacy `EventClassOffering` fields (`instructorUserId`, `dayIndex`, offering-level time/location columns) and use schema-correct relations.
- Updated class enrollment relation references from `eventClassOffering` to `offering` where required.
- Updated completed honor reads to parse from `MemberRequirement.metadata`.
- Updated student portal and export data queries to schema-correct relation names and fields.
- Updated PDF renderer data access from legacy relation names (`eventFormField`, `eventClassOffering`) to current names (`field`, `offering`).

Files updated:
- `app/teacher/dashboard/page.tsx`
- `app/teacher/class/[offeringId]/page.tsx`
- `app/director/events/[eventId]/classes/page.tsx`
- `app/director/events/[eventId]/classes/_components/class-assignment-board.tsx`
- `app/api/events/[eventId]/export/[clubId]/route.ts`
- `app/admin/events/[eventId]/reports/compliance/page.tsx`
- `app/layout.tsx`
- `lib/data/student-portal.ts`
- `lib/data/event-registration-export.ts`
- `lib/pdf/event-registration-pdf.tsx`

### 8. Seed and Prisma Data Shape Alignment
- Updated seed requirements from legacy flattened fields to `config` JSON payload format for `ClassRequirement`.
- Fixed readonly array/type mismatch in seed data.

File updated:
- `prisma/seed.ts`

### 9. Migration Folder Preparation
Created migration assets so Docker startup command `prisma migrate deploy` can run against a migration directory.

Files added:
- `prisma/migrations/migration_lock.toml`
- `prisma/migrations/20260304170500_init/migration.sql`

## Build/Runtime Validation Performed

### Passed
- `npm run build` (Next.js production build + typecheck + route generation)
- `npm start` (server boot verified under elevated run)
- `npx prisma@5.22.0 validate` (with `DATABASE_URL` set)
- `npx prisma@5.22.0 generate`

### Environment Blockers Observed During Testing
- Local `prisma migrate deploy` cannot complete without a running PostgreSQL endpoint at configured `DATABASE_URL`.
- Docker CLI was unavailable in this execution environment, so `docker compose` smoke test could not be executed here.

## Package/Tooling Updates Made
- Added Next/React/Auth/i18n/pdf/tooling dependencies and standard scripts required by the existing Dockerfile (`build`/`start`).
- Added/updated TypeScript settings generated/needed for Next typecheck compatibility.

Files updated:
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `next-env.d.ts` (generated)

## Operational Notes
- `node_modules` and `.next` were created locally to execute build/start verification.
- They should remain uncommitted in normal workflows.

Recommended `.gitignore` entries:
- `node_modules/`
- `.next/`
- `.DS_Store`
- `.env*`

## Final Status
Core requirement achieved: schema/action alignment, React 18 compatibility adjustments, auth/middleware stability fixes, migration directory prep, and successful production build verification.
