#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-docker}"
MISSING=0

need() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    echo "Missing required command: $name"
    MISSING=1
  fi
}

need docker

case "$MODE" in
  k8s|flux|full)
    need kubectl
    ;;
esac

case "$MODE" in
  flux|full)
    if ! command -v flux >/dev/null 2>&1; then
      echo "Missing required command: flux"
      echo "Install Flux CLI: https://fluxcd.io/flux/installation/"
      MISSING=1
    fi
    ;;
esac

if [ "$MISSING" -ne 0 ]; then
  exit 1
fi

echo "Prerequisites look good for mode: $MODE"
