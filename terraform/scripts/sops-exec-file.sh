#!/bin/bash
set -euo pipefail

if [ "$#" -lt 3 ]; then
  echo "Usage: $0 <encrypted-file> <plaintext-name> <command> [args...]" >&2
  exit 2
fi

sops_encrypted_file=$1
sops_plaintext_name=$2
shift 2

if [ ! -f "$sops_encrypted_file" ]; then
  echo "Encrypted file not found: $sops_encrypted_file" >&2
  exit 1
fi

case "$sops_plaintext_name" in
  "" | */*)
    echo "Plaintext name must be a file name without directory components" >&2
    exit 2
    ;;
esac

if ! command -v sops >/dev/null 2>&1; then
  echo "sops is required but was not found in PATH" >&2
  exit 1
fi

sops_command=""
sops_has_placeholder=false
for sops_argument in "$@"; do
  if [[ "$sops_argument" == *"__SOPS_FILE__"* ]]; then
    sops_has_placeholder=true
  fi
  printf -v sops_quoted_argument '%q' "$sops_argument"
  sops_command+="$sops_quoted_argument "
done

if [ "$sops_has_placeholder" != true ]; then
  echo "Command must contain an __SOPS_FILE__ placeholder" >&2
  exit 2
fi

sops_command=${sops_command//__SOPS_FILE__/\'\{\}\'}

exec sops exec-file \
  --no-fifo \
  --input-type binary \
  --output-type binary \
  --filename "$sops_plaintext_name" \
  "$sops_encrypted_file" \
  "$sops_command"
