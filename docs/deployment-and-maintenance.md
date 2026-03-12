# Deployment and Maintenance

## Launch sequence

1. Install dependencies with `npm ci`.
2. Generate Prisma client with `npx prisma generate`.
3. Apply database migrations with `npx prisma migrate deploy`.
4. Run production-mode startup self-checks with `npm run check:startup`.
5. Backfill encrypted medical data with `npm run backfill:medical-encryption`.
6. Re-run `npm run check:startup` and confirm there are no pending migrations or legacy medical rows.
7. Run verification gates with `npm run verify`.
8. Start the application with `npm start`.

## Required ongoing maintenance

- Clean expired auth throttling buckets on a schedule:
  - `npm run schedule:auth-rate-limit-cleanup`
- Audit user email normalization before login/account migrations:
  - `npm run audit:email-normalization`
- Re-run startup self-checks after deploys and before opening registration windows:
  - `npm run check:startup`

## What the startup self-checks enforce

- `npm run check:startup` always runs with `NODE_ENV=production` so it matches launch behavior.
- `MEDICAL_ENCRYPTION_KEY` is present and valid in production.
- All committed Prisma migrations are applied to the target database.
- Legacy medical plaintext / unbackfilled tetanus rows are not still present.

## Compliance sync operations

1. Open `/admin/compliance`.
2. Select the exact club roster year scope.
3. Upload the Sterling CSV and review:
   - `Will Update`
   - `Skipped`
   - `Ambiguous`
4. Apply only after review.
5. Use the stored `ComplianceSyncRun` row results as the audit source for:
   - matched record
   - reason
   - whether a row was updated or skipped on apply
   - previous and next background-check values
   - who applied the run

## Student portal link operations

- Parent/student portal access is explicit.
- After rollover, review and update `UserRosterMemberLink` assignments in `/admin/users`.
- Do not assume links carry forward automatically across roster years.

## Recommended production cron jobs

- Auth bucket cleanup:
  - every 15 minutes
  - command: `cd /path/to/app && npm run schedule:auth-rate-limit-cleanup`

## Release checklist

- `npm run lint`
- `npm test`
- `npm run build`
- `npm audit`
- `npm run check:startup`
