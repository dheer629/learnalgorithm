#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BUILD_DIR="/tmp/algolearn-k8s-build"
DOCKER_CONFIG_DIR="/tmp/algolearn-docker-config"
CLUSTER_CONTAINER="${CLUSTER_CONTAINER:-vcluster.cp.dev}"
NAMESPACE="algorithm-learn"

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"
mkdir -p "$DOCKER_CONFIG_DIR"
printf '{}\n' > "$DOCKER_CONFIG_DIR/config.json"
export DOCKER_CONFIG="$DOCKER_CONFIG_DIR"

rsync -a --delete \
  --exclude ".git" \
  --exclude ".venv" \
  --exclude "node_modules" \
  --exclude "frontend/node_modules" \
  --exclude "frontend/.next" \
  --exclude "backend/.pytest_cache" \
  --exclude "backend/.pytest_cache_local" \
  --exclude "backend/.pytest_tmp" \
  --exclude "backend/.ruff_cache" \
  "$ROOT_DIR/" "$BUILD_DIR/"

cd "$BUILD_DIR"

docker build -t algolearn-backend:local ./backend
docker build -t algolearn-frontend:local -f frontend/Dockerfile .

docker save algolearn-backend:local algolearn-frontend:local \
  | docker exec -i "$CLUSTER_CONTAINER" ctr -n k8s.io images import -

kubectl apply -f "$ROOT_DIR/infra/k8s/algorithm-learn.yaml"
kubectl -n "$NAMESPACE" rollout restart deploy/backend deploy/frontend
kubectl -n "$NAMESPACE" rollout status deploy/postgres --timeout=180s
kubectl -n "$NAMESPACE" rollout status deploy/redis --timeout=180s
kubectl -n "$NAMESPACE" rollout status deploy/backend --timeout=240s
kubectl -n "$NAMESPACE" rollout status deploy/frontend --timeout=240s

kubectl -n "$NAMESPACE" get pods,svc
