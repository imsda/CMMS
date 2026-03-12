# xCloud / VPS Deployment Guide (Docker + PostgreSQL)

This guide shows how to deploy the CMMS Next.js platform to xCloud (or any VPS) using Docker and Docker Compose.

## 1) Prerequisites

Make sure your server has:

- Docker Engine installed
- Docker Compose plugin installed (`docker compose` command)
- Git installed
- A domain/subdomain ready (optional but recommended)

## 2) Clone the project

```bash
git clone <YOUR_REPO_URL>
cd CMMS
```

## 3) Review container configuration files

This repository includes:

- `Dockerfile` for building the Next.js + Prisma container
- `docker-compose.yml` for orchestrating `web` + `postgres`

The image build process runs:

```bash
npm install && npx prisma generate && npm run build
```

The app container start command runs:

```bash
npx prisma migrate deploy && npm start
```

## 4) Configure environment variables in xCloud panel

In your xCloud app/service environment settings, set the following variables for the Node.js app:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `AUTH_SECRET`
- `NEXTAUTH_URL`
- `NEXT_PUBLIC_APP_URL`
- `MEDICAL_ENCRYPTION_KEY`

### Recommended values

- `DATABASE_URL`
  - If using the provided Compose service naming:
  - `postgresql://postgres:postgres@postgres:5432/cmms?schema=public`
- `NEXTAUTH_SECRET`
  - Generate a strong secret locally:
    ```bash
    openssl rand -base64 32
    ```
- `NEXTAUTH_URL`
  - Your public app URL, for example:
  - `https://cmms.yourdomain.com`
- `NEXT_PUBLIC_APP_URL`
  - Usually the same value as `NEXTAUTH_URL`
- `MEDICAL_ENCRYPTION_KEY`
  - Must be a 64-character hex string or a base64 string that decodes to 32 bytes

> Keep `NEXTAUTH_SECRET` private and never commit it to Git.

## 5) Deploy with Docker Compose

From the repository root:

```bash
docker compose up -d --build
```

This will:

1. Build the `web` image from `Dockerfile`
2. Start a PostgreSQL 15 container
3. Start the Next.js app on port `3000`

## 6) Verify deployment

Check service status:

```bash
docker compose ps
```

Check logs:

```bash
docker compose logs -f web
docker compose logs -f postgres
```

If everything is healthy, visit:

- `http://<SERVER_IP>:3000`
- or your configured domain

Before opening access broadly, run:

```bash
docker compose exec web npm run check:startup
```

If you are deploying against an existing database, also run:

```bash
docker compose exec web npm run backfill:medical-encryption
docker compose exec web npm run check:startup
```

## 7) Ongoing operations

### Update to latest code

```bash
git pull
docker compose up -d --build
```

### Run one-off Prisma migration command manually (if needed)

```bash
docker compose exec web npx prisma migrate deploy
```

### Run startup self-checks manually

```bash
docker compose exec web npm run check:startup
```

### Stop services

```bash
docker compose down
```

### Stop services and remove database volume (destructive)

```bash
docker compose down -v
```

## 8) Optional production hardening

- Put Nginx/Caddy/Traefik in front of port `3000` for TLS termination
- Restrict direct public access to PostgreSQL port `5432`
- Use strong custom DB credentials (not defaults)
- Back up `postgres_data` volume regularly
- Set Docker restart policies (already set to `unless-stopped`)
- Schedule `npm run schedule:auth-rate-limit-cleanup` every 15 minutes
