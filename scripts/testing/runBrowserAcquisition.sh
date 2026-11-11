#!/bin/sh
set -eu

script_directory=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
cd "$(dirname "$(dirname "$script_directory")")/packages/frontend"

exec bun --no-env-file run test:browser-acquisition "$@"
