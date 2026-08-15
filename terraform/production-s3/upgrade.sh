#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
"$SCRIPT_DIR/../scripts/sops-exec-file.sh" \
  "$SCRIPT_DIR/terraform.backend.sops" \
  terraform.backend \
  terraform init -backend-config=__SOPS_FILE__ -upgrade
