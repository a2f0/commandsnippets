#!/bin/bash
set -e

LIMIT="${1:-staging}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TF_DIR="$SCRIPT_DIR/../container-registry"

ECR_ACCESS_KEY_ID=$(terraform -chdir="$TF_DIR" output -raw ecr-pull-access-key)
ECR_SECRET_ACCESS_KEY=$(terraform -chdir="$TF_DIR" output -raw ecr-pull-secret-access-key)

LIMIT_ARGS=()
if [ "$LIMIT" != "all" ]; then
  LIMIT_ARGS=(-l "$LIMIT")
fi

ansible-playbook -i "$SCRIPT_DIR/inventory.yaml" "$SCRIPT_DIR/playbook.yaml" "${LIMIT_ARGS[@]}" \
  -e "ecr_access_key_id=$ECR_ACCESS_KEY_ID" \
  -e "ecr_secret_access_key=$ECR_SECRET_ACCESS_KEY"
