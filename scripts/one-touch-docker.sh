#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# shellcheck source=scripts/load-env.sh
source "$ROOT_DIR/scripts/load-env.sh"

ENV_FILE="deploy/docker/.env"
ensure_env_file "$ENV_FILE" "deploy/docker/.env.example"
load_project_env "$ROOT_DIR"
load_env_file "$ENV_FILE"

echo "Building and starting Algorithm Learn with Docker Compose..."
echo "Image tag: ${IMAGE_TAG:-local}"
docker compose --env-file "$ENV_FILE" build backend frontend
docker compose --env-file "$ENV_FILE" up -d postgres redis backend frontend

echo "Waiting for backend health..."
for _ in $(seq 1 30); do
  if curl -fsS "http://localhost:${BACKEND_PORT:-8000}/api/health/live" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

cat <<INFO

Docker deployment complete.

Frontend: http://localhost:${FRONTEND_PORT:-3000}
Backend:  http://localhost:${BACKEND_PORT:-8000}
API Docs: http://localhost:${BACKEND_PORT:-8000}/docs

Useful commands:
  docker compose --env-file deploy/docker/.env ps
  deploy/docker/docker-status.sh
  deploy/docker/docker-clean.sh
INFO
