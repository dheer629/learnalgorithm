#!/usr/bin/env bash
set -euo pipefail

MESSAGE="${1:-}"
if [ -z "$MESSAGE" ]; then
  echo "Usage: ./scripts/gitops-commit.sh \"Commit message\""
  exit 2
fi

if git status --short | grep -E '(^|\s)(\.env|.*\.secret\.yaml|kubeconfig|\.kube/|id_rsa|id_ed25519)' >/dev/null 2>&1; then
  echo "Refusing to commit because a secret-like file appears in git status."
  git status --short
  exit 1
fi

echo "Git status before commit:"
git status --short

git add .gitignore .env.example README.md package.json package-lock.json docker-compose.yml \
  backend frontend deploy docs scripts .github

if git diff --cached --quiet; then
  echo "No staged changes to commit."
  exit 0
fi

git commit -m "$MESSAGE"
COMMIT_SHA="$(git rev-parse --short HEAD)"
git push

echo "Committed and pushed: $COMMIT_SHA"

if command -v flux >/dev/null 2>&1; then
  flux reconcile source git learnalgorithm-repo -n flux-system || true
  flux reconcile kustomization learnalgorithm-app -n flux-system || true
fi
