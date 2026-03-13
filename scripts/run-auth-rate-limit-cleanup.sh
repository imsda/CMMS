#!/usr/bin/env sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "[auth-rate-limit-cleanup] started at $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
cd "$ROOT_DIR"
npm run cleanup:auth-rate-limits
echo "[auth-rate-limit-cleanup] completed at $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
