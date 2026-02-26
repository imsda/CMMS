# CMMS Local Setup Guide

This guide walks a developer through cloning, configuring, migrating, seeding, and running the Club Management platform locally.

---

## 1) Prerequisites

Install the following before starting:

- **Node.js 20+** (recommended LTS)
- **npm** (comes with Node)
- **PostgreSQL 14+** (local or remote instance)
- **Git**

Optional but helpful:

- Prisma Studio (`npx prisma studio`) for data inspection.

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

## 4) Create and configure `.env`

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

If `.env.example` does not exist yet, create `.env` manually.

### Required environment variables

```env
# Prisma / PostgreSQL connection string
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/cmms?schema=public"

# NextAuth secret used to sign/encrypt session tokens
# Use a long random value in real environments
NEXTAUTH_SECRET="replace-with-a-long-random-secret"

# Optional in NextAuth v5 projects; include if your auth setup expects it
AUTH_SECRET="replace-with-a-long-random-secret"

# Optional but often useful for callbacks / absolute URLs
NEXTAUTH_URL="http://localhost:3000"

# Optional seed overrides (defaults exist in prisma/seed.ts)
SEED_SUPER_ADMIN_EMAIL="superadmin@cmms.local"
SEED_SUPER_ADMIN_PASSWORD="ChangeMeNow123!"
SEED_SUPER_ADMIN_NAME="CMMS Super Admin"
```

> Notes:
> - `DATABASE_URL` is required by Prisma at runtime.
> - At least one auth secret must be defined for secure auth operation. For compatibility, set both `NEXTAUTH_SECRET` and `AUTH_SECRET` to the same strong value in local development.
> - Seed variables are optional because the seed script provides defaults.

---

## 5) Generate Prisma client

```bash
npx prisma generate
```

---

## 6) Run database migrations

For a new local database:

```bash
npx prisma migrate dev
```

If you only need to apply existing migrations in a CI-like environment, use:

```bash
npx prisma migrate deploy
```

---

## 7) Seed baseline data

```bash
npx prisma db seed
```

The seed script creates:

- A default Super Admin user.
- A default testing club (`CONF-TEST-CLUB`).
- A current active roster year for that club.
- A starter honor/class catalog set with sample requirements.

---

## 8) Start the development server

```bash
npm run dev
```

Then open:

- `http://localhost:3000`

---

## 9) First login

Use the seeded super admin credentials:

- **Email:** value of `SEED_SUPER_ADMIN_EMAIL` (default `superadmin@cmms.local`)
- **Password:** value of `SEED_SUPER_ADMIN_PASSWORD` (default `ChangeMeNow123!`)

Change these immediately in any shared or non-local environment.

---

## 10) Useful developer commands

```bash
# Open Prisma Studio
npx prisma studio

# Re-run seed
npx prisma db seed

# Reset local database (destructive)
npx prisma migrate reset
```

---

## 11) Troubleshooting

### Prisma cannot connect to database
- Verify Postgres is running.
- Confirm `DATABASE_URL` host, port, username, password, and database name.
- Ensure the target DB exists and your user has rights.

### Auth/session errors on login
- Ensure `NEXTAUTH_SECRET` (and/or `AUTH_SECRET`) is set.
- Restart the dev server after editing `.env`.

### Seed script fails
- Run migrations first (`npx prisma migrate dev`).
- Check for unique conflicts if reusing a shared database.

