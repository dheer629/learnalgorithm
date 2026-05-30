#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OS_NAME="$(uname -s 2>/dev/null || echo unknown)"
IS_WSL="false"

if grep -qi microsoft /proc/version 2>/dev/null; then
  IS_WSL="true"
fi

echo "Repository: $ROOT_DIR"
echo "OS: $OS_NAME"
echo "WSL: $IS_WSL"
echo "Shell: ${SHELL:-unknown}"
echo "Docker: $(command -v docker || echo missing)"
echo "kubectl: $(command -v kubectl || echo missing)"
echo "flux: $(command -v flux || echo missing)"
echo "FLUXONM: $(command -v FLUXONM || echo missing)"

if command -v kubectl >/dev/null 2>&1; then
  echo "Kubernetes context: $(kubectl config current-context 2>/dev/null || echo unavailable)"
fi
