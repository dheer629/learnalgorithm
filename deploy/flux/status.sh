#!/usr/bin/env bash
set -euo pipefail

flux get sources git -n flux-system
flux get kustomizations -n flux-system
kubectl get pods -n learnalgorithm
kubectl get svc -n learnalgorithm
