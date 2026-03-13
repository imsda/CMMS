#!/usr/bin/env bash
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed or not available in PATH." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "docker compose is not available. Install Docker Compose v2." >&2
  exit 1
fi

echo "Stopping existing compose stack"
docker compose down

echo "Starting compose stack"
docker compose up -d --build

echo "Waiting for postgres and web to settle"
sleep 5

echo "Checking Prisma migration status inside web container"
docker compose exec web npx prisma migrate status

echo "Running Prisma connectivity smoke test inside web container"
docker compose exec web node -e '
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
prisma.$queryRaw`SELECT 1`
  .then((result) => {
    console.log("Prisma SELECT 1 result:", result);
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
'

if [[ "${DOCKER_CLEANUP:-0}" == "1" ]]; then
  echo "Cleaning up compose stack"
  docker compose down
fi

echo "Docker compose verification completed successfully."
