#!/bin/bash
set -euo pipefail

LIMIT="${1:-staging}"
if [ "$#" -gt 0 ]; then
  shift
fi
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TF_DIR="$SCRIPT_DIR/../terraform/container-registry"
export ANSIBLE_CONFIG="$SCRIPT_DIR/../ansible.cfg"

ECR_ACCESS_KEY_ID=$(terraform -chdir="$TF_DIR" output -raw ecr-pull-access-key)
ECR_SECRET_ACCESS_KEY=$(terraform -chdir="$TF_DIR" output -raw ecr-pull-secret-access-key)

if [[ ! "$ECR_ACCESS_KEY_ID" =~ ^(AKIA|ASIA)[A-Z0-9]{16}$ ]]; then
  echo "Terraform did not return a valid ecr-pull-access-key output" >&2
  exit 1
fi

if [[ ! "$ECR_SECRET_ACCESS_KEY" =~ ^[A-Za-z0-9/+=]{40}$ ]]; then
  echo "Terraform did not return a valid ecr-pull-secret-access-key output" >&2
  exit 1
fi

export ECR_ACCESS_KEY_ID
export ECR_SECRET_ACCESS_KEY

if ! command -v sops >/dev/null 2>&1; then
  echo "sops is required but was not found in PATH" >&2
  exit 1
fi

umask 077
secret_temp_dir=$(mktemp -d)
production_env_file="$secret_temp_dir/production.env"
staging_env_file="$secret_temp_dir/staging.env"

cleanup_secrets() {
  rm -f -- "$production_env_file" "$staging_env_file" || true
  rmdir "$secret_temp_dir" || true
}
trap cleanup_secrets EXIT

sops decrypt \
  --input-type binary \
  --output-type binary \
  --output "$production_env_file" \
  "$SCRIPT_DIR/environment/production.env.sops"
sops decrypt \
  --input-type binary \
  --output-type binary \
  --output "$staging_env_file" \
  "$SCRIPT_DIR/environment/staging.env.sops"

export ANSIBLE_PRODUCTION_ENV_FILE="$production_env_file"
export ANSIBLE_STAGING_ENV_FILE="$staging_env_file"

LIMIT_ARGS=()
if [ "$LIMIT" != "all" ]; then
  LIMIT_ARGS=(-l "$LIMIT")
fi

"$SCRIPT_DIR/../terraform/scripts/sops-exec-file.sh" \
  "$SCRIPT_DIR/inventory.yaml.sops" \
  inventory.yaml \
  ansible-playbook \
  --inventory=__SOPS_FILE__ \
  "$SCRIPT_DIR/playbook.yaml" \
  "${LIMIT_ARGS[@]}" \
  "$@"
