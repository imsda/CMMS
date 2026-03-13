#!/usr/bin/env sh
set -e

echo "Configuring pg_hba.conf for Docker network access"

PG_HBA="$PGDATA/pg_hba.conf"

if ! grep -q "0.0.0.0/0" "$PG_HBA"; then
  echo "host all all 0.0.0.0/0 scram-sha-256" >> "$PG_HBA"
fi

echo "pg_hba.conf updated for Docker network authentication"
