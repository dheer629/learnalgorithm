#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="algorithm-learn"

start_forward() {
  local name="$1"
  local mapping="$2"
  local pid_file="/tmp/algolearn-${name}-port-forward.pid"
  local log_file="/tmp/algolearn-${name}-port-forward.log"

  if [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
    kill "$(cat "$pid_file")"
  fi

  nohup kubectl -n "$NAMESPACE" port-forward "svc/$name" "$mapping" >"$log_file" 2>&1 &
  echo "$!" > "$pid_file"
}

start_forward frontend 3000:3000
start_forward backend 8000:8000

sleep 2
curl -fsS http://localhost:8000/api/health
printf '\nFrontend: http://localhost:3000\nBackend:  http://localhost:8000/api/health\n'
