#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir"

if ! command -v sops >/dev/null 2>&1; then
    echo "Error: sops is required to decrypt local secrets." >&2
    exit 1
fi

umask 077
sops decrypt --output .env .env-local-development.sops.env
chmod 600 .env

echo "Decrypted local development secrets to .env"
