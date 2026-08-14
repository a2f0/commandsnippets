#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

export GOOGLE_CLOUD_KEYFILE_JSON=./service-account.json
terraform --version
"$SCRIPT_DIR/../scripts/sops-exec-file.sh" \
  "$SCRIPT_DIR/main.tfvars.sops" \
  main.tfvars \
  terraform apply --var-file=__SOPS_FILE__ --auto-approve
