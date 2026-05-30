#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

echo "Stopping Algorithm Learn Docker stack..."
docker compose --env-file deploy/docker/.env down --remove-orphans
echo "Docker stack stopped. Volumes are preserved. Use 'docker compose down -v' only when you intentionally want to delete data."
