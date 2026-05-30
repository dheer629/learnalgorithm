#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

USE_FLUXONM="false"
for arg in "$@"; do
  if [ "$arg" = "--use-fluxonm" ]; then
    USE_FLUXONM="true"
  fi
done

NAMESPACE="${NAMESPACE:-learnalgorithm}"
POSTGRES_USER="${POSTGRES_USER:-learnalgorithm}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-learnalgorithm}"
POSTGRES_DB="${POSTGRES_DB:-learnalgorithm}"
ADMIN_TOKEN="${ADMIN_TOKEN:-local-admin-token}"
IMAGE_TAG="${IMAGE_TAG:-local}"
IMAGE_REGISTRY="${IMAGE_REGISTRY:-}"
BACKEND_IMAGE="${IMAGE_REGISTRY}learnalgorithm-backend:${IMAGE_TAG}"
FRONTEND_IMAGE="${IMAGE_REGISTRY}learnalgorithm-frontend:${IMAGE_TAG}"

if ! command -v flux >/dev/null 2>&1; then
  cat <<'INFO'
Flux CLI is missing.

Install/bootstrap Flux first, then rerun this script:
  curl -s https://fluxcd.io/install.sh | sudo bash
  flux check --pre

For GitHub bootstrap, use your GitHub token and repository owner:
  export GITHUB_TOKEN=<token>
  flux bootstrap github --owner=dheer629 --repository=learnalgorithm --branch=main --path=deploy/flux --personal
INFO
  exit 1
fi

"$ROOT_DIR/scripts/check-prereqs.sh" flux

echo "Ensuring Flux and app namespaces exist..."
kubectl create namespace flux-system --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f deploy/k8s/namespace.yaml

if [ -z "$IMAGE_REGISTRY" ]; then
  echo "Building local images for GitOps-applied manifests..."
  docker build -t "$BACKEND_IMAGE" backend
  docker build -t "$FRONTEND_IMAGE" -f frontend/Dockerfile .
  CONTEXT="$(kubectl config current-context 2>/dev/null || true)"
  if echo "$CONTEXT" | grep -qi kind && command -v kind >/dev/null 2>&1; then
    CLUSTER_NAME="${CONTEXT#kind-}"
    kind load docker-image "$BACKEND_IMAGE" --name "$CLUSTER_NAME"
    kind load docker-image "$FRONTEND_IMAGE" --name "$CLUSTER_NAME"
  fi
else
  echo "Using registry images: $BACKEND_IMAGE and $FRONTEND_IMAGE"
fi

echo "Creating local app secret outside Git..."
kubectl create secret generic learnalgorithm-backend-secret \
  -n "$NAMESPACE" \
  --from-literal=DATABASE_URL="postgresql+asyncpg://$POSTGRES_USER:$POSTGRES_PASSWORD@postgres:5432/$POSTGRES_DB" \
  --from-literal=REDIS_URL="redis://redis:6379/0" \
  --from-literal=ADMIN_TOKEN="$ADMIN_TOKEN" \
  --from-literal=POSTGRES_USER="$POSTGRES_USER" \
  --from-literal=POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
  --from-literal=POSTGRES_DB="$POSTGRES_DB" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "Applying Flux GitOps source and kustomization..."
kubectl apply -k deploy/flux

if [ "$USE_FLUXONM" = "true" ] && command -v FLUXONM >/dev/null 2>&1; then
  echo "FLUXONM detected. Running optional status helper."
  FLUXONM status || true
fi

echo "Reconciling Flux source and application..."
flux reconcile source git learnalgorithm-repo -n flux-system --with-source
flux reconcile kustomization learnalgorithm-app -n flux-system --with-source

echo "Waiting for app resources..."
kubectl -n "$NAMESPACE" rollout status deploy/redis --timeout=180s
kubectl -n "$NAMESPACE" rollout status statefulset/postgres --timeout=180s
kubectl -n "$NAMESPACE" rollout status deploy/learnalgorithm-backend --timeout=240s
kubectl -n "$NAMESPACE" rollout status deploy/learnalgorithm-frontend --timeout=240s

flux get sources git -n flux-system
flux get kustomizations -n flux-system
kubectl get pods -n "$NAMESPACE"
kubectl get svc -n "$NAMESPACE"

"$ROOT_DIR/scripts/expose-info.sh"
