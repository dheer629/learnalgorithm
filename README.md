# Algorithm Learn

Algorithm Learn is a full-stack learning cockpit for browsing, searching, inspecting, visualizing, and running Python algorithms from `TheAlgorithms/Python`.

## Architecture

- Frontend: Next.js, React, Tailwind CSS, React Query, Zustand, Monaco Editor, lucide-react.
- Backend: FastAPI, SQLAlchemy async, Alembic, PostgreSQL, Redis, slowapi, structlog, optional Sentry.
- Execution: Piston API first, local isolated Python subprocess fallback with AST validation, timeout, and output limits.
- Data: PostgreSQL populated by the admin sync endpoint.
- Deployment: Docker Compose, local Kubernetes manifests, and Flux GitOps manifests.

## Install

```bash
npm install
python -m venv .venv
.venv\Scripts\python -m pip install -r backend\requirements.txt
```

On Linux/macOS, activate your venv normally and use `python -m pip install -r backend/requirements.txt`.

## Local Development

Frontend:

```bash
npm --workspace frontend run dev
```

Backend:

```bash
cd backend
uvicorn app.main:app --reload
```

Run migrations:

```bash
cd backend
alembic upgrade head
```

Sync algorithm database:

```bash
curl -X POST http://localhost:8000/api/admin/sync \
  -H "X-Admin-Token: local-admin-token"
```

## Docker

```bash
chmod +x scripts/*.sh deploy/docker/*.sh deploy/flux/*.sh
./scripts/one-touch-deploy.sh --mode docker
```

Access:

- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- API docs: http://localhost:8000/docs

## Kubernetes

```bash
./scripts/one-touch-deploy.sh --mode k8s
```

The script builds local images, applies `deploy/k8s`, creates a local secret, waits for rollouts, and starts port-forwarding.

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

## Tests and Checks

Frontend tests:

```bash
npm --workspace frontend run test
```

Frontend build:

```bash
npm --workspace frontend run build
```

Backend tests:

```bash
cd backend
python -m pytest
```

Backend lint:

```bash
cd backend
ruff check .
black --check .
```

Docker Compose config:

```bash
docker compose --env-file deploy/docker/.env.example config
```

Kustomize build:

```bash
kubectl kustomize deploy/k8s
kubectl kustomize deploy/flux
```

## Admin and Health APIs

- `GET /api/health`
- `GET /api/health/live`
- `GET /api/health/ready`
- `POST /api/admin/sync` requires `X-Admin-Token`
- `GET /api/admin/sync/status` requires `X-Admin-Token`
- `POST /api/admin/validate-examples` requires `X-Admin-Token`

Search supports pagination and filters while preserving the legacy list response:

```bash
curl "http://localhost:8000/api/algorithms?q=search&difficulty=beginner&meta=true&page=1&page_size=20"
```

## Documentation

- [Deployment Guide](docs/DEPLOYMENT_GUIDE.md)
- [GitOps Runbook](docs/GITOPS_RUNBOOK.md)
- [FLUXONM Integration](docs/FLUXONM_INTEGRATION.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

## Rollback

```bash
git log --oneline -5
git revert <commit_sha>
git push
flux reconcile source git learnalgorithm-repo -n flux-system
flux reconcile kustomization learnalgorithm-app -n flux-system
```
