#!/usr/bin/env bash
set -euo pipefail

flux reconcile source git learnalgorithm-repo -n flux-system --with-source
flux reconcile kustomization learnalgorithm-app -n flux-system --with-source
