#!/bin/sh
set -eu

script_directory=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
cd "$(dirname "$script_directory")/packages/frontend"

# Node's experimental global Web Storage accessor can replace jsdom's
# localStorage implementation in Vitest workers unless it is disabled.
NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--no-experimental-webstorage"
export NODE_OPTIONS

exec pnpm exec vitest --no-watch "$@"
