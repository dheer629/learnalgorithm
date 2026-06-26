#!/usr/bin/env bash

ensure_env_file() {
  local env_file="$1"
  local example_file="$2"

  if [ ! -f "$env_file" ] && [ -f "$example_file" ]; then
    echo "Creating $env_file from $example_file"
    cp "$example_file" "$env_file"
  fi
}

load_env_file() {
  local env_file="$1"
  local line key value

  [ -f "$env_file" ] || return 0

  while IFS= read -r line || [ -n "$line" ]; do
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"

    [ -z "$line" ] && continue
    [[ "$line" == \#* ]] && continue
    [[ "$line" == export\ * ]] && line="${line#export }"
    [[ "$line" != *=* ]] && continue

    key="${line%%=*}"
    value="${line#*=}"
    key="${key%"${key##*[![:space:]]}"}"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"

    if [[ ! "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
      echo "Skipping invalid env key in $env_file: $key" >&2
      continue
    fi

    if [[ "$value" == \"*\" && "$value" == *\" ]]; then
      value="${value:1:${#value}-2}"
    elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
      value="${value:1:${#value}-2}"
    fi

    if [ -z "${!key+x}" ]; then
      export "$key=$value"
    fi
  done < "$env_file"
}

load_project_env() {
  local root_dir="$1"

  ensure_env_file "$root_dir/.env" "$root_dir/.env.example"
  load_env_file "$root_dir/.env"
}
