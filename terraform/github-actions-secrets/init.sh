#!/bin/bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
cd "$script_dir"

if [ -z "${AWS_PROFILE:-}" ]; then
  echo "AWS_PROFILE must name a profile with access to Terraform state." >&2
  exit 1
fi

AWS_PROFILE="$AWS_PROFILE" \
  "$script_dir/../scripts/sops-exec-file.sh" \
  "$script_dir/../container-registry/terraform.backend.sops" \
  terraform.backend \
  terraform init \
  -reconfigure \
  -backend-config=__SOPS_FILE__ \
  -backend-config=key=github-actions-secrets/terraform.tfstate \
  -backend-config=use_lockfile=true
