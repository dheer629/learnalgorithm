# Deployment Guide

## Prerequisites

- Docker with Docker Compose v2.
- `kubectl` for Kubernetes mode.
- Flux CLI and Flux controllers for GitOps mode.
- Optional: `kind` if your Kubernetes context is a kind cluster.

## Docker One-Touch

```bash
chmod +x scripts/*.sh deploy/docker/*.sh deploy/flux/*.sh
./scripts/one-touch-deploy.sh --mode docker
```

The script creates `deploy/docker/.env` from `deploy/docker/.env.example`, builds:

- `learnalgorithm-backend:local`
- `learnalgorithm-frontend:local`

Then it starts PostgreSQL, Redis, backend, and frontend.

Access:

- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- API docs: http://localhost:8000/docs

Cleanup:

```bash
deploy/docker/docker-clean.sh
```

## Kubernetes One-Touch

```bash
./scripts/one-touch-deploy.sh --mode k8s
```

The script:

- Builds local images.
- Creates the `learnalgorithm` namespace.
- Creates a local Kubernetes secret from environment variables.
- Applies `deploy/k8s` with Kustomize.
- Starts managed port-forward processes with PID files under `.runtime/`.

Stop port-forward:

```bash
./scripts/expose-info.sh stop
```

## Flux GitOps

```bash
./scripts/one-touch-deploy.sh --mode flux
```

Flux watches:

```text
https://github.com/dheer629/learnalgorithm.git
```

and applies:

```text
./deploy/k8s
```

Secrets are intentionally not committed. The Flux script creates the local app secret before reconciliation.

This repository uses Flux reconcile commands compatible with Flux CLI 2.4.0 and newer.

## Environment Variables

Common variables:

- `FRONTEND_PORT`
- `BACKEND_PORT`
- `POSTGRES_PORT`
- `REDIS_PORT`
- `IMAGE_TAG`
- `IMAGE_REGISTRY`
- `ADMIN_TOKEN`
- `PISTON_URL`

The one-touch scripts load `.env` automatically and keep already-exported shell
variables as overrides. For example, on a WSL machine with local TLS inspection:

```bash
PIP_TRUSTED_HOST_ARGS="--trusted-host pypi.org --trusted-host files.pythonhosted.org --trusted-host pypi.python.org" \
  ./scripts/one-touch-deploy.sh --mode flux
```

For Flux Git fetches behind a local antivirus or proxy root CA, export that root
as PEM and pass it without committing it:

```bash
FLUX_GIT_CA_CERT=/tmp/local-root-ca.pem ./scripts/one-touch-deploy.sh --mode flux
```

## Images

Local default:

```text
learnalgorithm-backend:local
learnalgorithm-frontend:local
```

For clusters that cannot see local Docker images, push to a registry and update the Kustomize image settings or use a registry-aware overlay.

## Admin Sync

```bash
curl -X POST http://localhost:8000/api/admin/sync \
  -H "X-Admin-Token: local-admin-token"
```

Background sync:

```bash
curl -X POST "http://localhost:8000/api/admin/sync?background=true" \
  -H "X-Admin-Token: local-admin-token"
```

Status:

```bash
curl http://localhost:8000/api/admin/sync/status \
  -H "X-Admin-Token: local-admin-token"
```
