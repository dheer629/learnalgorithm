#!/usr/bin/env bash
set -euo pipefail

flux resume kustomization learnalgorithm-app -n flux-system
flux reconcile kustomization learnalgorithm-app -n flux-system
