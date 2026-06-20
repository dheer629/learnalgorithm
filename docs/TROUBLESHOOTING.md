# Troubleshooting

## Docker Not Running

```bash
docker info
docker compose version
```

Start Docker Desktop or your Linux Docker service, then rerun:

```bash
./scripts/one-touch-deploy.sh --mode docker
```

## Wrong Kubernetes Context

```bash
kubectl config current-context
kubectl config get-contexts
```

Switch context before deploying.

## Namespace Not Found

```bash
kubectl apply -f deploy/k8s/namespace.yaml
kubectl get ns learnalgorithm
```

## Image Pull Error

For local laptop clusters, use local images:

```bash
docker images | grep learnalgorithm
```

For kind:

```bash
kind load docker-image learnalgorithm-backend:local
kind load docker-image learnalgorithm-frontend:local
```

## CrashLoopBackOff

```bash
kubectl describe pod -n learnalgorithm <pod>
kubectl logs -n learnalgorithm deploy/learnalgorithm-backend
```

## Backend DB Connection Issue

```bash
kubectl get pods -n learnalgorithm
kubectl logs -n learnalgorithm statefulset/postgres
kubectl get secret learnalgorithm-backend-secret -n learnalgorithm
```

## Frontend Cannot Reach Backend

```bash
kubectl get svc -n learnalgorithm
curl http://localhost:8000/api/health/live
```

Restart port-forward:

```bash
./scripts/expose-info.sh stop
./scripts/expose-info.sh
```

## Flux Source Not Ready

```bash
flux get sources git -n flux-system
flux logs -n flux-system --kind=GitRepository --name=learnalgorithm-repo
```

If the error contains `x509: certificate signed by unknown authority`, the
cluster is likely behind local HTTPS inspection. Recreate the Flux Git CA secret
through the one-touch script:

```bash
./scripts/one-touch-deploy.sh --mode flux
```

For a custom proxy or antivirus root CA:

```bash
FLUX_GIT_CA_CERT=/path/to/local-root-ca.pem ./scripts/one-touch-deploy.sh --mode flux
```

## Flux Kustomization Failed

```bash
flux get kustomizations -n flux-system
flux logs -n flux-system --kind=Kustomization --name=learnalgorithm-app
kubectl describe kustomization learnalgorithm-app -n flux-system
```

## Port Already In Use

```bash
./scripts/expose-info.sh stop
lsof -i :3000
lsof -i :8000
```

Set alternate ports:

```bash
FRONTEND_PORT=3001 BACKEND_PORT=8001 ./scripts/one-touch-deploy.sh --mode k8s
```

## WSL Localhost Access

Use the Windows browser with `localhost` first. If that fails, inspect WSL IP:

```bash
hostname -I
```
