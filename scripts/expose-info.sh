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
      if ps -p "$pid" -o args= | grep -q 'kubectl .*port-forward'; then
        echo "Stopping old $name port-forward ($pid)"
        kill "$pid" >/dev/null 2>&1 || true
      else
        echo "Ignoring stale $name pid file ($pid)"
      fi
    fi
    rm -f "$pid_file"
  fi
}

stop_port_users() {
  local local_port="$1"
  ps -eo pid=,comm=,args= \
    | awk -v prefix="${local_port}:" '$2 == "kubectl" {
        for (i = 3; i <= NF; i++) {
          if (index($i, prefix) == 1) {
            print $1
            break
          }
        }
      }' \
    | while read -r pid; do
        if [ -n "$pid" ] && kill -0 "$pid" >/dev/null 2>&1; then
          echo "Stopping existing kubectl port-forward on localhost:$local_port ($pid)"
          kill "$pid" >/dev/null 2>&1 || true
        fi
      done
}

start_forward() {
  local name="$1"
  local service="$2"
  local local_port="$3"
  local remote_port="$4"
  stop_forward "$name"
  stop_port_users "$local_port"
  echo "Starting $name port-forward on localhost:$local_port"
  if command -v setsid >/dev/null 2>&1; then
    setsid kubectl -n "$NAMESPACE" port-forward "svc/$service" "$local_port:$remote_port" >"$RUNTIME_DIR/$name.log" 2>&1 < /dev/null &
  else
    nohup kubectl -n "$NAMESPACE" port-forward "svc/$service" "$local_port:$remote_port" >"$RUNTIME_DIR/$name.log" 2>&1 < /dev/null &
  fi
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
