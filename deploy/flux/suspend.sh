#!/usr/bin/env bash
set -euo pipefail

flux suspend kustomization learnalgorithm-app -n flux-system
