#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

docker compose --env-file deploy/docker/.env ps
echo
echo "Frontend: http://localhost:${FRONTEND_PORT:-3000}"
echo "Backend:  http://localhost:${BACKEND_PORT:-8000}"
echo "API Docs: http://localhost:${BACKEND_PORT:-8000}/docs"
