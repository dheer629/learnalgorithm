# GitOps Runbook

Git is the source of truth for application and deployment state.

Flux resources:

- `GitRepository`: `learnalgorithm-repo`
- `Kustomization`: `learnalgorithm-app`
- Flux namespace: `flux-system`
- App namespace: `learnalgorithm`

## Commit and Reconcile

```bash
./scripts/gitops-commit.sh "Add production one-touch deployment and Flux GitOps setup"
```

Manual reconcile:

```bash
flux reconcile source git learnalgorithm-repo -n flux-system
flux reconcile kustomization learnalgorithm-app -n flux-system
```

Status:

```bash
flux get sources git -n flux-system
flux get kustomizations -n flux-system
kubectl get pods -n learnalgorithm
kubectl get svc -n learnalgorithm
```

## Local TLS Inspection

`deploy/flux/source-gitrepository.yaml` references the local secret
`flux-system/learnalgorithm-github-ca`. The one-touch Flux script recreates this
secret from the Linux CA bundle before applying Flux resources. On WSL, it also
auto-detects the Windows `AVG Web/Mail Shield Root` certificate when present and
adds it to the bundle so Flux can clone GitHub through local HTTPS inspection.
The script mounts that bundle into `source-controller` and restarts the
controller so the refreshed trust store is used for Git fetches.

For another antivirus, proxy, or corporate root CA, export the root certificate
as PEM and run:

```bash
FLUX_GIT_CA_CERT=/path/to/local-root-ca.pem ./scripts/one-touch-deploy.sh --mode flux
```

Use the same `FLUX_GIT_CA_CERT` fallback if WSL cannot execute Windows tools
such as `powershell.exe`.

To disable the AVG auto-detection:

```bash
FLUX_AUTO_TRUST_WINDOWS_AVG=false ./scripts/one-touch-deploy.sh --mode flux
```

## Rollback

```bash
git log --oneline -5
git revert <commit_sha>
git push
flux reconcile source git learnalgorithm-repo -n flux-system
flux reconcile kustomization learnalgorithm-app -n flux-system
```

## Avoid Drift

Use manual `kubectl apply` only for local testing. For lasting deployment changes, edit files under `deploy/k8s`, commit them, push, and let Flux reconcile the cluster.

Secrets are not committed. Recreate local secrets with:

```bash
kubectl create secret generic learnalgorithm-backend-secret \
  -n learnalgorithm \
  --from-literal=DATABASE_URL='postgresql+asyncpg://learnalgorithm:learnalgorithm@postgres:5432/learnalgorithm' \
  --from-literal=REDIS_URL='redis://redis:6379/0' \
  --from-literal=ADMIN_TOKEN='local-admin-token' \
  --from-literal=POSTGRES_USER='learnalgorithm' \
  --from-literal=POSTGRES_PASSWORD='learnalgorithm' \
  --from-literal=POSTGRES_DB='learnalgorithm' \
  --dry-run=client -o yaml | kubectl apply -f -
```
