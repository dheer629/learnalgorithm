#!/usr/bin/env bash
set -euo pipefail

flux reconcile source git learnalgorithm-repo -n flux-system
flux reconcile kustomization learnalgorithm-app -n flux-system
