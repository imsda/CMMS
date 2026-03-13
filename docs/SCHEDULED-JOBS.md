# Scheduled Jobs

Read `docs/system-specification.md` first before extending scheduled maintenance in this repository.

## Purpose

Phase 8 extends the existing CMMS operations layer with lightweight, idempotent scheduled jobs. It does not introduce a separate worker platform or parallel registration/reporting system.

Current scheduled jobs:

- `auth-rate-limit-cleanup`
- `inactive-insurance-card-cleanup`
- `director-readiness-reminders`

## Runtime Model

- Core logic lives in `lib/scheduled-jobs.ts`
- Persistent idempotency uses the `ScheduledJobRun` Prisma model
- Jobs can be triggered manually with `npm run schedule:jobs`
- Jobs can be triggered remotely through `POST /api/jobs/run`
- Mutating jobs continue writing audit entries through the existing audit log infrastructure

## Required Environment

- `DATABASE_URL`
- `CRON_SECRET` for `POST /api/jobs/run` (required for any remote cron trigger)
- `RESEND_API_KEY` and `RESEND_FROM_EMAIL` for reminder emails

If email configuration is missing, the reminder job records a skipped result instead of failing the rest of the system.
If `CRON_SECRET` is unset or empty, `POST /api/jobs/run` responds with `401 Unauthorized`.

## Manual Usage

Run all jobs:

```bash
npm run schedule:jobs
```

Run one job:

```bash
npm run schedule:jobs -- director-readiness-reminders
```

Run multiple jobs:

```bash
npm run schedule:jobs -- auth-rate-limit-cleanup inactive-insurance-card-cleanup
```

## API Usage

Example:

```bash
curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"jobs":["auth-rate-limit-cleanup","director-readiness-reminders"]}' \
  http://localhost:3000/api/jobs/run
```

The route expects the header exactly as `Authorization: Bearer <CRON_SECRET>`.
`job` query parameters are also supported for simple cron integrations.

## Safety Rules

- Jobs are idempotent per UTC day through `ScheduledJobRun`
- Failed daily jobs can be retried safely on the same day
- Reminder emails only send when club readiness gaps exist
- Storage cleanup reuses the existing inactive insurance-card purge logic and data rules
- This workflow extends existing email, audit, storage, and auth-rate-limit systems rather than rebuilding them
