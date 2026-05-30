#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

MODE="docker"
EXTRA_ARGS=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --mode)
      MODE="${2:-}"
      shift 2
      ;;
    --use-fluxonm)
      EXTRA_ARGS+=("$1")
      shift
      ;;
    *)
      echo "Unknown argument: $1"
      exit 2
      ;;
  esac
done

case "$MODE" in
  docker|k8s|flux|full) ;;
  *)
    echo "Unsupported mode: $MODE"
    echo "Use: docker, k8s, flux, or full"
    exit 2
    ;;
esac

echo "Detecting local environment..."
"$ROOT_DIR/scripts/detect-env.sh"
echo

if [ ! -f ".env" ]; then
  echo "Creating .env from .env.example"
  cp .env.example .env
fi

case "$MODE" in
  docker)
    "$ROOT_DIR/scripts/one-touch-docker.sh"
    ;;
  k8s)
    "$ROOT_DIR/scripts/one-touch-k8s.sh"
    ;;
  flux)
    "$ROOT_DIR/scripts/one-touch-flux.sh" "${EXTRA_ARGS[@]}"
    ;;
  full)
    "$ROOT_DIR/scripts/one-touch-docker.sh"
    "$ROOT_DIR/scripts/one-touch-k8s.sh"
    "$ROOT_DIR/scripts/one-touch-flux.sh" "${EXTRA_ARGS[@]}"
    ;;
esac
