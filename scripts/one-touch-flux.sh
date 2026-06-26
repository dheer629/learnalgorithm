#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# shellcheck source=scripts/load-env.sh
source "$ROOT_DIR/scripts/load-env.sh"
load_project_env "$ROOT_DIR"

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
PIP_TRUSTED_HOST_ARGS="${PIP_TRUSTED_HOST_ARGS:-}"
NPM_CONFIG_STRICT_SSL="${NPM_CONFIG_STRICT_SSL:-true}"
FLUX_GIT_CA_SECRET="${FLUX_GIT_CA_SECRET:-learnalgorithm-github-ca}"
FLUX_GIT_CA_CERT="${FLUX_GIT_CA_CERT:-}"
FLUX_AUTO_TRUST_WINDOWS_AVG="${FLUX_AUTO_TRUST_WINDOWS_AVG:-true}"

append_file_if_present() {
  local source_file="$1"
  local target_file="$2"
  if [ -n "$source_file" ] && [ -f "$source_file" ]; then
    cat "$source_file" >>"$target_file"
    printf '\n' >>"$target_file"
    return 0
  fi
  return 1
}

export_windows_avg_root() {
  local output_file="$1"

  if [ "$FLUX_AUTO_TRUST_WINDOWS_AVG" != "true" ] || ! command -v powershell.exe >/dev/null 2>&1; then
    return 1
  fi

  if ! powershell.exe -NoProfile -NonInteractive -Command "\$PSVersionTable.PSVersion | Out-Null" >/dev/null 2>&1; then
    return 1
  fi

  local win_der_file der_file
  win_der_file="$(powershell.exe -NoProfile -NonInteractive -Command "\$path = Join-Path \$env:TEMP ('learnalgorithm-avg-root-' + [guid]::NewGuid().ToString() + '.der'); Write-Output \$path" 2>/dev/null | tr -d '\r')"
  [ -n "$win_der_file" ] || return 1

  if powershell.exe -NoProfile -NonInteractive -Command "\$cert = Get-ChildItem Cert:\\CurrentUser\\Root, Cert:\\LocalMachine\\Root -ErrorAction SilentlyContinue | Where-Object { \$_.Subject -like '*AVG Web/Mail Shield Root*' } | Select-Object -First 1; if (\$cert) { Export-Certificate -Cert \$cert -FilePath '$win_der_file' -Type CERT | Out-Null; exit 0 } exit 1" >/dev/null 2>&1; then
    der_file="$(wslpath -u "$win_der_file" 2>/dev/null || true)"
    if [ -s "$der_file" ] && command -v openssl >/dev/null 2>&1; then
      openssl x509 -inform DER -in "$der_file" -out "$output_file" >/dev/null 2>&1
      rm -f "$der_file" >/dev/null 2>&1 || true
      [ -s "$output_file" ]
      return
    fi
  fi

  if [ -n "${der_file:-}" ]; then
    rm -f "$der_file" >/dev/null 2>&1 || true
  fi
  return 1
}

patch_source_controller_ca() {
  local patch_file

  if ! kubectl -n flux-system get deployment source-controller >/dev/null 2>&1; then
    return 0
  fi

  patch_file="$(mktemp)"
  cat >"$patch_file" <<EOF
spec:
  template:
    spec:
      containers:
        - name: manager
          env:
            - name: SSL_CERT_FILE
              value: /tmp/learnalgorithm-git-ca/ca.crt
            - name: GIT_SSL_CAINFO
              value: /tmp/learnalgorithm-git-ca/ca.crt
          volumeMounts:
            - name: learnalgorithm-git-ca
              mountPath: /tmp/learnalgorithm-git-ca
              readOnly: true
      volumes:
        - name: learnalgorithm-git-ca
          secret:
            secretName: $FLUX_GIT_CA_SECRET
EOF

  echo "Mounting Flux Git CA bundle into source-controller..."
  kubectl -n flux-system patch deployment source-controller --type=strategic --patch-file "$patch_file" >/dev/null
  rm -f "$patch_file" >/dev/null 2>&1 || true
  kubectl -n flux-system rollout restart deploy/source-controller >/dev/null
  kubectl -n flux-system rollout status deploy/source-controller --timeout=120s
}

create_flux_git_ca_secret() {
  local bundle_file
  bundle_file="$(mktemp)"
  local added_local_ca="false"

  if [ -f /etc/ssl/certs/ca-certificates.crt ]; then
    cp /etc/ssl/certs/ca-certificates.crt "$bundle_file"
  elif [ -n "${SSL_CERT_FILE:-}" ] && [ -f "$SSL_CERT_FILE" ]; then
    cp "$SSL_CERT_FILE" "$bundle_file"
  else
    : >"$bundle_file"
  fi

  if append_file_if_present "$FLUX_GIT_CA_CERT" "$bundle_file"; then
    added_local_ca="true"
  fi

  local avg_root_file
  avg_root_file="$(mktemp)"
  if export_windows_avg_root "$avg_root_file"; then
    append_file_if_present "$avg_root_file" "$bundle_file" >/dev/null || true
    added_local_ca="true"
  fi

  echo "Creating Flux Git CA secret: $FLUX_GIT_CA_SECRET"
  kubectl -n flux-system delete secret "$FLUX_GIT_CA_SECRET" --ignore-not-found=true >/dev/null
  kubectl -n flux-system create secret generic "$FLUX_GIT_CA_SECRET" --from-file=ca.crt="$bundle_file" >/dev/null

  if [ "$added_local_ca" = "true" ] && docker ps --format '{{.Names}}' | grep -qx 'vcluster.cp.dev'; then
    echo "Installing local CA into vcluster.cp.dev for controller/image pulls..."
    docker cp "$bundle_file" vcluster.cp.dev:/usr/local/share/ca-certificates/learnalgorithm-local-ca.crt >/dev/null
    docker exec vcluster.cp.dev update-ca-certificates >/dev/null
    docker exec vcluster.cp.dev systemctl restart containerd >/dev/null 2>&1 || true
  fi
}

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
create_flux_git_ca_secret
patch_source_controller_ca

if [ -z "$IMAGE_REGISTRY" ]; then
  echo "Building local images for GitOps-applied manifests..."
  BACKEND_BUILD_ARGS=()
  if [ -n "$PIP_TRUSTED_HOST_ARGS" ]; then
    BACKEND_BUILD_ARGS+=(--build-arg "PIP_TRUSTED_HOST_ARGS=$PIP_TRUSTED_HOST_ARGS")
  fi
  FRONTEND_BUILD_ARGS=(--build-arg "NPM_CONFIG_STRICT_SSL=$NPM_CONFIG_STRICT_SSL")
  BUILD_DIR="$(mktemp -d)"
  trap 'rm -rf "$BUILD_DIR"' EXIT
  git archive HEAD | tar -x -C "$BUILD_DIR"
  export DOCKER_CONFIG="$BUILD_DIR/.docker"
  mkdir -p "$DOCKER_CONFIG"
  printf '{}\n' >"$DOCKER_CONFIG/config.json"
  docker build "${BACKEND_BUILD_ARGS[@]}" -t "$BACKEND_IMAGE" "$BUILD_DIR/backend"
  docker build "${FRONTEND_BUILD_ARGS[@]}" -t "$FRONTEND_IMAGE" -f "$BUILD_DIR/frontend/Dockerfile" "$BUILD_DIR"
  if docker ps --format '{{.Names}}' | grep -qx 'vcluster.cp.dev'; then
    echo "Detected vcluster.cp.dev. Importing local images into vCluster containerd..."
    docker save "$BACKEND_IMAGE" "$FRONTEND_IMAGE" | docker exec -i vcluster.cp.dev ctr -n k8s.io images import -
  fi
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
flux reconcile source git learnalgorithm-repo -n flux-system
flux reconcile kustomization learnalgorithm-app -n flux-system
kubectl -n "$NAMESPACE" delete pod -l app=learnalgorithm-backend --ignore-not-found=true
kubectl -n "$NAMESPACE" delete pod -l app=learnalgorithm-frontend --ignore-not-found=true

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
