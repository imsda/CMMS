#!/usr/bin/env sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set." >&2
  exit 1
fi

if [ -z "${POSTGRES_USER:-}" ] || [ -z "${POSTGRES_PASSWORD:-}" ]; then
  echo "POSTGRES_USER and POSTGRES_PASSWORD must be set for DB config verification." >&2
  exit 1
fi

parsed="$(node -e '
const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) {
  process.exit(1);
}

try {
  const parsedUrl = new URL(rawUrl);
  const dbName = parsedUrl.pathname.replace(/^\/+/, "").split("?")[0];
  console.log([
    parsedUrl.username,
    parsedUrl.password,
    parsedUrl.hostname,
    parsedUrl.port || "5432",
    dbName
  ].join("\n"));
} catch {
  process.exit(1);
}
')"

if [ -z "$parsed" ]; then
  echo "DATABASE_URL is not a supported PostgreSQL connection string." >&2
  exit 1
fi

db_user=$(printf '%s\n' "$parsed" | sed -n '1p')
db_password=$(printf '%s\n' "$parsed" | sed -n '2p')
db_host=$(printf '%s\n' "$parsed" | sed -n '3p')
db_port=$(printf '%s\n' "$parsed" | sed -n '4p')
db_name=$(printf '%s\n' "$parsed" | sed -n '5p')

if [ "$db_user" != "$POSTGRES_USER" ]; then
  echo "DATABASE_URL user '$db_user' does not match POSTGRES_USER '$POSTGRES_USER'." >&2
  exit 1
fi

if [ "$db_password" != "$POSTGRES_PASSWORD" ]; then
  echo "DATABASE_URL password does not match POSTGRES_PASSWORD." >&2
  exit 1
fi

if [ -n "${POSTGRES_DB:-}" ] && [ "$db_name" != "$POSTGRES_DB" ]; then
  echo "DATABASE_URL database '$db_name' does not match POSTGRES_DB '$POSTGRES_DB'." >&2
  exit 1
fi

echo "Database configuration verified for ${db_user}@${db_host}:${db_port}/${db_name}."
