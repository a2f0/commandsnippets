#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
terraform --version
"$SCRIPT_DIR/../scripts/sops-exec-file.sh" \
  "$SCRIPT_DIR/main.tfvars.sops" \
  main.tfvars \
  terraform apply -input=false -auto-approve --var-file=__SOPS_FILE__
