# Launch Operations Checklist

## Before launch

- Confirm `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_SECRET`, and `MEDICAL_ENCRYPTION_KEY` are set.
- Run `npx prisma migrate deploy`.
- Run `npm run backfill:medical-encryption`.
- Run `npm run audit:email-normalization`.
- Run `npm run check:startup` (this now executes the production-mode startup checks).
- Resolve any admin dashboard system-health warnings.

## After launch

- Review auth-rate-limit cleanup output daily during initial rollout.
- Review compliance sync runs after each apply.
- Spot-check student/parent links after roster changes or rollover.
- Watch for any `pending_migrations` or `medical_backfill_incomplete` warnings on the admin dashboard.
