#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set." >&2
  exit 1
fi

if [[ -z "${POSTGRES_USER:-}" || -z "${POSTGRES_PASSWORD:-}" ]]; then
  echo "POSTGRES_USER and POSTGRES_PASSWORD must be set for DB config verification." >&2
  exit 1
fi

if [[ "$DATABASE_URL" =~ ^postgres(ql)?://([^:]+):([^@]+)@([^:/?#]+)(:([0-9]+))?/([^?]+) ]]; then
  db_user="${BASH_REMATCH[2]}"
  db_password="${BASH_REMATCH[3]}"
  db_host="${BASH_REMATCH[4]}"
  db_port="${BASH_REMATCH[6]:-5432}"
  db_name="${BASH_REMATCH[7]}"
else
  echo "DATABASE_URL is not a supported PostgreSQL connection string." >&2
  exit 1
fi

if [[ "$db_user" != "$POSTGRES_USER" ]]; then
  echo "DATABASE_URL user '$db_user' does not match POSTGRES_USER '$POSTGRES_USER'." >&2
  exit 1
fi

if [[ "$db_password" != "$POSTGRES_PASSWORD" ]]; then
  echo "DATABASE_URL password does not match POSTGRES_PASSWORD." >&2
  exit 1
fi

if [[ -n "${POSTGRES_DB:-}" && "$db_name" != "$POSTGRES_DB" ]]; then
  echo "DATABASE_URL database '$db_name' does not match POSTGRES_DB '$POSTGRES_DB'." >&2
  exit 1
fi

echo "Database configuration verified for ${db_user}@${db_host}:${db_port}/${db_name}."
