#!/bin/bash
set -euo pipefail

LIMIT="${1:-staging}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TF_DIR="$SCRIPT_DIR/../container-registry"
export ANSIBLE_CONFIG="$SCRIPT_DIR/../ansible.cfg"

ECR_ACCESS_KEY_ID=$(terraform -chdir="$TF_DIR" output -raw ecr-pull-access-key)
ECR_SECRET_ACCESS_KEY=$(terraform -chdir="$TF_DIR" output -raw ecr-pull-secret-access-key)
export ECR_ACCESS_KEY_ID
export ECR_SECRET_ACCESS_KEY

if ! command -v sops >/dev/null 2>&1; then
  echo "sops is required but was not found in PATH" >&2
  exit 1
fi

umask 077
deploy_key_temp_dir=$(mktemp -d)
backend_deploy_key_file="$deploy_key_temp_dir/tearleads-backend-deploy-key"
frontend_deploy_key_file="$deploy_key_temp_dir/tearleads-frontend-deploy-key"

cleanup_deploy_keys() {
  rm -f -- "$backend_deploy_key_file" "$frontend_deploy_key_file" || true
  rmdir "$deploy_key_temp_dir" || true
}
trap cleanup_deploy_keys EXIT

sops decrypt \
  --input-type binary \
  --output-type binary \
  --output "$backend_deploy_key_file" \
  "$SCRIPT_DIR/../ssh_keys/tearleads-backend-deploy-key.sops"
sops decrypt \
  --input-type binary \
  --output-type binary \
  --output "$frontend_deploy_key_file" \
  "$SCRIPT_DIR/../ssh_keys/tearleads-frontend-deploy-key.sops"

export ANSIBLE_BACKEND_DEPLOY_KEY_FILE="$backend_deploy_key_file"
export ANSIBLE_FRONTEND_DEPLOY_KEY_FILE="$frontend_deploy_key_file"

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
