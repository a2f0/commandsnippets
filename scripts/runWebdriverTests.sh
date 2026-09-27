#!/bin/sh
set -eu

script_directory=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
cd "$(dirname "$script_directory")/packages/frontend"
exec pnpm run ci-headless -- "$@"
