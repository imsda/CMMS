# CMMS Production Readiness Audit (2026-03-06)

## A. Executive summary

**Overall verdict: HIGH RISK / NOT READY**

The repository builds successfully and core pages compile, but there are multiple high-impact correctness and reliability gaps in business-critical flows. The most serious issues are in class enrollment integrity (race-condition overbooking and single-class-per-event hard block), registration lifecycle enforcement (submission allowed outside registration window), attendee-specific dynamic form persistence mismatch, and post-commit email failure behavior that reports errors after data is already committed. Security posture is moderate (role checks are broadly present), but lacks hardening controls such as brute-force/rate-limiting and has weak runtime guardrails because linting is not configured and no automated test suite exists.

### Top 10 issues (ordered by severity)
1. Enrollment capacity race can overbook classes under concurrent requests.
2. Enrollment logic blocks attendees to only one class per event (no time-slot model), conflicting with scheduling expectations.
3. Registration submissions are not server-enforced against event registration windows.
4. Attendee-specific dynamic field semantics are inconsistent between registration and check-in/reporting logic.
5. Registration submit can persist data then fail due to outbound email failure, leading to false-negative UX and retriable confusion.
6. No test suite (`npm test` missing), leaving critical flows unverified.
7. Linting is non-operational (`next lint` interactive prompt due missing ESLint config), reducing static guardrails.
8. TypeScript strict mode disabled (`strict: false`) for a safety-critical data domain.
9. Operationally required environment and DB availability are under-validated in automation (migrate deploy failed without DB).
10. No brute-force/rate-limit guard on credentials login flow.

### Must-fix blockers before production
- Fix enrollment transaction semantics for atomic capacity enforcement.
- Define and implement scheduling model (time-slot-aware or explicitly single-class business rule).
- Enforce registration open/close windows server-side in registration actions.
- Reconcile attendee-specific dynamic field storage/validation with check-in and reporting logic.
- Decouple email failures from registration commit status or implement transactional outbox pattern.
- Add baseline integration tests for auth/registration/enrollment/report exports.

---

## C. Validation report (executed commands)

### Commands run and outcomes
- `npm install` ✅ (dependencies installed; prisma client generated)
- `npm run lint` ❌ (fails: prompts for ESLint setup interactively)
- `CI=1 npm run lint` ❌ (same ESLint setup prompt; non-CI-safe)
- `npx tsc --noEmit` ✅ (typecheck passed with current tsconfig)
- `npm test` ❌ (no test script defined)
- `npm run build` ✅ (Next production build passed)
- `npx prisma validate` ❌ (failed without `DATABASE_URL`)
- `DATABASE_URL='postgresql://postgres:postgres@localhost:5432/cmms?schema=public' npx prisma validate` ✅
- `DATABASE_URL='postgresql://postgres:postgres@localhost:5432/cmms?schema=public' npx prisma generate` ✅
- `DATABASE_URL='postgresql://postgres:postgres@localhost:5432/cmms?schema=public' npx prisma migrate deploy` ⚠️ (failed: local PostgreSQL not running at localhost:5432)
- `npm start` ✅ (server booted on localhost:3000)

### Missing prerequisites / blockers
- No local PostgreSQL instance in this environment for full migration/deploy/runtime DB-backed flow testing.
- Lint pipeline is not bootstrapped (missing committed ESLint config).

### What could not be fully validated
- End-to-end UI login with real seeded accounts (no active DB).
- Data mutation workflows requiring persistence across sessions (registration, rollover, enrollment, reports).
- Docker smoke test (`docker compose`) not executed in this run.

---

## D. Test gap report

### Most important untested workflows
1. Credentials auth success/failure + session claim propagation (`id`, `role`, `clubId`).
2. Role authorization boundaries across admin/director/teacher/student routes and server actions.
3. Event registration lifecycle (draft/submit, late fee windows, required fields, attendee-specific fields).
4. Enrollment concurrency and seat-capacity enforcement under simultaneous requests.
5. Yearly rollover integrity (member copy-forward, active year toggling, duplicate prevention).
6. Report and PDF exports access control and data correctness.

### Specific tests to add first
- Integration test: `submitEventRegistration` rejects outside window and preserves idempotent behavior.
- Transactional concurrency test: two parallel enrollments into one remaining seat (must allow one, reject one).
- Integration test: attendee-specific dynamic fields round-trip from UI payload to `EventFormResponse.attendeeId`.
- Authorization tests for API routes (`/api/events/[eventId]/export/[clubId]`, `/api/secure-files/[filename]`).
- Regression test for email failure path ensuring commit status and UI feedback are consistent.

---

## E. Final ship recommendation

**Can this be safely deployed now?** No.

**What must change first?** Resolve enrollment integrity and registration-window enforcement, fix dynamic field attendee-scoping mismatch, and harden post-commit email handling. Add at least a small integration test suite for auth/registration/enrollment/reporting critical paths.

**Residual risks after fixes:** brute-force protection and operational observability (structured error telemetry, alerting on failed mail/report/PDF jobs) should still be added before high-volume production use with medical data.
