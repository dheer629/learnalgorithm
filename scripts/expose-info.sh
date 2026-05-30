#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${NAMESPACE:-learnalgorithm}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
RUNTIME_DIR=".runtime"

mkdir -p "$RUNTIME_DIR"

stop_forward() {
  local name="$1"
  local pid_file="$RUNTIME_DIR/$name.pid"
  if [ -f "$pid_file" ]; then
    local pid
    pid="$(cat "$pid_file")"
    if kill -0 "$pid" >/dev/null 2>&1; then
      echo "Stopping old $name port-forward ($pid)"
      kill "$pid" >/dev/null 2>&1 || true
    fi
    rm -f "$pid_file"
  fi
}

start_forward() {
  local name="$1"
  local service="$2"
  local local_port="$3"
  local remote_port="$4"
  stop_forward "$name"
  echo "Starting $name port-forward on localhost:$local_port"
  kubectl -n "$NAMESPACE" port-forward "svc/$service" "$local_port:$remote_port" >"$RUNTIME_DIR/$name.log" 2>&1 &
  echo "$!" >"$RUNTIME_DIR/$name.pid"
}

if [ "${1:-start}" = "stop" ]; then
  stop_forward frontend
  stop_forward backend
  exit 0
fi

start_forward frontend learnalgorithm-frontend "$FRONTEND_PORT" 3000
start_forward backend learnalgorithm-backend "$BACKEND_PORT" 8000

cat <<INFO

Application deployed successfully.

Namespace:
  $NAMESPACE

Frontend:
  http://localhost:$FRONTEND_PORT

Backend:
  http://localhost:$BACKEND_PORT

API Docs:
  http://localhost:$BACKEND_PORT/docs

Useful commands:
  kubectl get pods -n $NAMESPACE
  kubectl logs -n $NAMESPACE deploy/learnalgorithm-backend
  kubectl logs -n $NAMESPACE deploy/learnalgorithm-frontend
  ./scripts/expose-info.sh stop
INFO
