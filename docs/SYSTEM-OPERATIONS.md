# System Operations

## Database Authentication in Docker

Docker network connections to PostgreSQL use `pg_hba.conf` host rules, not the local Unix socket rules.
That means a containerized app can fail to authenticate over `postgres:5432` even when `psql` works locally on the database container itself.

Key rules:

- Docker network access depends on `host` entries in `pg_hba.conf`
- Local socket auth can succeed even while Docker TCP auth fails
- `DATABASE_URL` credentials must match `POSTGRES_USER` and `POSTGRES_PASSWORD`
- Docker volumes preserve old database state, including prior passwords and auth behavior

Recovery command for a persisted volume with stale credentials:

```bash
docker compose exec postgres psql -U postgres -c "ALTER USER postgres WITH PASSWORD 'postgres';"
```

Operational notes:

- The Docker Postgres service mounts `docker/postgres-init/01-auth-config.sh` to add a SCRAM host rule for Docker networks
- The web container runs `scripts/verify-db-config.sh` before migrations so credential drift fails fast
- The runtime startup check performs `SELECT 1` and exits in production if the database is unreachable

## Docker Compose Verification

Run the full Docker verification flow with:

```bash
npm run verify:docker
```

That script performs:

- `docker compose down`
- `docker compose up -d --build`
- `docker compose exec web npx prisma migrate status`
- a Prisma `SELECT 1` query from inside the web container

Set `DOCKER_CLEANUP=1` if you want the script to stop the stack again after the checks finish:

```bash
DOCKER_CLEANUP=1 npm run verify:docker
```
