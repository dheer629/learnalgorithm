#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

NAMESPACE="${NAMESPACE:-learnalgorithm}"
IMAGE_TAG="${IMAGE_TAG:-local}"
IMAGE_REGISTRY="${IMAGE_REGISTRY:-}"
BACKEND_IMAGE="${IMAGE_REGISTRY}learnalgorithm-backend:${IMAGE_TAG}"
FRONTEND_IMAGE="${IMAGE_REGISTRY}learnalgorithm-frontend:${IMAGE_TAG}"
POSTGRES_USER="${POSTGRES_USER:-learnalgorithm}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-learnalgorithm}"
POSTGRES_DB="${POSTGRES_DB:-learnalgorithm}"
ADMIN_TOKEN="${ADMIN_TOKEN:-local-admin-token}"

"$ROOT_DIR/scripts/check-prereqs.sh" k8s

echo "Building local images..."
BUILD_DIR="$(mktemp -d)"
trap 'rm -rf "$BUILD_DIR"' EXIT
git archive HEAD | tar -x -C "$BUILD_DIR"
export DOCKER_CONFIG="$BUILD_DIR/.docker"
mkdir -p "$DOCKER_CONFIG"
printf '{}\n' >"$DOCKER_CONFIG/config.json"
docker build -t "$BACKEND_IMAGE" "$BUILD_DIR/backend"
docker build -t "$FRONTEND_IMAGE" -f "$BUILD_DIR/frontend/Dockerfile" "$BUILD_DIR"

if docker ps --format '{{.Names}}' | grep -qx 'vcluster.cp.dev'; then
  echo "Detected vcluster.cp.dev. Importing local images into vCluster containerd..."
  docker save "$BACKEND_IMAGE" "$FRONTEND_IMAGE" | docker exec -i vcluster.cp.dev ctr -n k8s.io images import -
fi

CONTEXT="$(kubectl config current-context 2>/dev/null || true)"
if echo "$CONTEXT" | grep -qi kind && command -v kind >/dev/null 2>&1; then
  CLUSTER_NAME="${CONTEXT#kind-}"
  echo "Detected kind context. Loading local images into kind cluster: $CLUSTER_NAME"
  kind load docker-image "$BACKEND_IMAGE" --name "$CLUSTER_NAME"
  kind load docker-image "$FRONTEND_IMAGE" --name "$CLUSTER_NAME"
fi

echo "Creating namespace and backend secret..."
kubectl apply -f deploy/k8s/namespace.yaml
kubectl create secret generic learnalgorithm-backend-secret \
  -n "$NAMESPACE" \
  --from-literal=DATABASE_URL="postgresql+asyncpg://$POSTGRES_USER:$POSTGRES_PASSWORD@postgres:5432/$POSTGRES_DB" \
  --from-literal=REDIS_URL="redis://redis:6379/0" \
  --from-literal=ADMIN_TOKEN="$ADMIN_TOKEN" \
  --from-literal=POSTGRES_USER="$POSTGRES_USER" \
  --from-literal=POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
  --from-literal=POSTGRES_DB="$POSTGRES_DB" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "Applying Kubernetes manifests..."
kubectl apply -k deploy/k8s
kubectl -n "$NAMESPACE" set image deploy/learnalgorithm-backend backend="$BACKEND_IMAGE"
kubectl -n "$NAMESPACE" set image deploy/learnalgorithm-frontend frontend="$FRONTEND_IMAGE"
kubectl -n "$NAMESPACE" delete pod -l app=learnalgorithm-backend --ignore-not-found=true
kubectl -n "$NAMESPACE" delete pod -l app=learnalgorithm-frontend --ignore-not-found=true

echo "Waiting for deployments..."
kubectl -n "$NAMESPACE" rollout status deploy/redis --timeout=180s
kubectl -n "$NAMESPACE" rollout status statefulset/postgres --timeout=180s
kubectl -n "$NAMESPACE" rollout status deploy/learnalgorithm-backend --timeout=240s
kubectl -n "$NAMESPACE" rollout status deploy/learnalgorithm-frontend --timeout=240s

kubectl get pods -n "$NAMESPACE"
kubectl get svc -n "$NAMESPACE"

"$ROOT_DIR/scripts/expose-info.sh"
