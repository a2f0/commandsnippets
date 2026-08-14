#!/bin/bash
set -e

LIMIT="${1:-staging}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TF_DIR="$SCRIPT_DIR/../container-registry"

ECR_ACCESS_KEY_ID=$(terraform -chdir="$TF_DIR" output -raw ecr-pull-access-key)
ECR_SECRET_ACCESS_KEY=$(terraform -chdir="$TF_DIR" output -raw ecr-pull-secret-access-key)
export ECR_ACCESS_KEY_ID
export ECR_SECRET_ACCESS_KEY

LIMIT_ARGS=()
if [ "$LIMIT" != "all" ]; then
  LIMIT_ARGS=(-l "$LIMIT")
fi

"$SCRIPT_DIR/../scripts/sops-exec-file.sh" \
  "$SCRIPT_DIR/inventory.yaml.sops" \
  inventory.yaml \
  ansible-playbook \
  --inventory=__SOPS_FILE__ \
  "$SCRIPT_DIR/playbook.yaml" \
  "${LIMIT_ARGS[@]}"
