# CMMS Setup Guide (Developer Onboarding)

This guide walks a developer through cloning, configuring, migrating, seeding, and running CMMS locally.

---

## 1) Prerequisites

Install the following:

- **Git**
- **Node.js 20+** (LTS recommended)
- **npm 10+**
- **PostgreSQL 14+** (local, Docker, or managed)

Optional but recommended:

- **Prisma Studio** (`npx prisma studio`) for inspecting data

---

## 2) Clone the repository

```bash
git clone <YOUR_REPOSITORY_URL>
cd CMMS
```

---

## 3) Install dependencies

```bash
npm install
```

---

## 4) Configure environment variables (`.env`)

Create a `.env` file at repository root.

If an `.env.example` exists, copy it:

```bash
cp .env.example .env
```

If not, create `.env` manually and define the variables below.

### Required variables

```env
# Prisma datasource (PostgreSQL)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/cmms?schema=public"

# NextAuth session/token secret (required)
NEXTAUTH_SECRET="replace-with-a-long-random-secret"
```

### Strongly recommended compatibility variable

```env
# Some NextAuth setups also reference AUTH_SECRET
# Keep it equal to NEXTAUTH_SECRET in local dev
AUTH_SECRET="replace-with-the-same-long-random-secret"
```

### URL/callback variable (recommended)

```env
# Local app URL for auth callbacks and absolute URL generation
NEXTAUTH_URL="http://localhost:3000"
```

### Optional email integration variables

```env
# Optional: enables registration receipt emails via Resend
RESEND_API_KEY="re_xxx"
RESEND_FROM_EMAIL="CMMS <noreply@yourdomain.org>"
```

### Optional seed override variables

```env
# Optional: override defaults used by prisma/seed.ts
SEED_SUPER_ADMIN_EMAIL="superadmin@cmms.local"
SEED_SUPER_ADMIN_PASSWORD="ChangeMeNow123!"
SEED_SUPER_ADMIN_NAME="CMMS Super Admin"
```

---

## 5) Generate Prisma Client

```bash
npx prisma generate
```

Run this after first install and whenever Prisma schema changes.

---

## 6) Apply database migrations

For local development (creates new migration if schema drift exists):

```bash
npx prisma migrate dev
```

For deploy/CI style usage (apply already-generated migrations):

```bash
npx prisma migrate deploy
```

---

## 7) Seed baseline data

```bash
npx prisma db seed
```

The seed script creates baseline records, including:

- Super Admin account
- Test club (`CONF-TEST-CLUB`)
- Active roster year for the current year
- Starter honors/classes + requirements

---

## 8) Start the development server

If your repo already defines scripts, use:

```bash
npm run dev
```

If scripts are not defined, run Next directly:

```bash
npx next dev
```

Then open:

- `http://localhost:3000`

---

## 9) First login

Sign in with seeded Super Admin credentials:

- **Email:** `SEED_SUPER_ADMIN_EMAIL` (default: `superadmin@cmms.local`)
- **Password:** `SEED_SUPER_ADMIN_PASSWORD` (default: `ChangeMeNow123!`)

Immediately rotate these credentials for any shared or non-local environment.

---

## 10) Useful Prisma commands

```bash
# Open database browser
npx prisma studio

# Regenerate client
npx prisma generate

# Re-run seed
npx prisma db seed

# Reset local database (destructive)
npx prisma migrate reset
```

---

## 11) Quick verification checklist

After setup, verify:

1. You can sign in as Super Admin.
2. You can access `/admin/dashboard`.
3. Seeded test club appears in relevant admin/director flows.
4. Prisma Studio shows expected base records.

---

## 12) Troubleshooting

### Prisma cannot connect

- Confirm PostgreSQL is running.
- Confirm DB exists and credentials in `DATABASE_URL` are correct.
- Validate host/port/network connectivity.

### Login fails or session errors occur

- Ensure `NEXTAUTH_SECRET` is present.
- Ensure `NEXTAUTH_URL` is correct for local domain/port.
- Restart dev server after editing `.env`.

### Seed fails

- Run migrations first.
- Check for uniqueness conflicts in reused/shared databases.
- Review terminal stack trace and rerun after fixing data constraints.

### Email receipt errors

- If email sending is desired, set both `RESEND_API_KEY` and `RESEND_FROM_EMAIL`.
- If omitted, CMMS will skip receipt emails by design.

---

## 13) Handover-ready minimum for staging

Before handing to conference testers:

- Point `DATABASE_URL` to managed/staging PostgreSQL.
- Use a strong production-grade `NEXTAUTH_SECRET`.
- Set `NEXTAUTH_URL` to the staging URL.
- Seed or manually provision initial Super Admin account.
- Confirm PDF export route and report pages render with sample registrations.

