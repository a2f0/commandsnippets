#!/bin/bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
cd "$script_dir"

if [ ! -f encrypted-secrets.auto.tfvars.json ]; then
  echo "Run ./refresh-secrets.sh before applying." >&2
  exit 1
fi

if [ -z "${AWS_PROFILE:-}" ]; then
  echo "AWS_PROFILE must name a profile with access to Terraform state." >&2
  exit 1
fi

github_token_value="$(gh auth token)"

AWS_PROFILE="$AWS_PROFILE" \
GITHUB_TOKEN="$github_token_value" \
  terraform apply
