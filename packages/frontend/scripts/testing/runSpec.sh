#!/bin/sh
# This script runs a single test using wdio.
set -eu
if [ "$#" -ne 1 ] || [ -z "$1" ]; then
    echo "Usage: $0 <spec-file>" >&2
    echo "Example: $0 test/specs/basic.spec.ts" >&2
    exit 1
fi

script_directory=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
cd "$(dirname "$(dirname "$script_directory")")"
SPEC_FILE=$1
export SPEC_FILE
exec bun x start-server-and-test 'bun run server-test' http-get://localhost:8081 "bun x wdio test/wdio.shared.conf.ts --spec \"\$SPEC_FILE\""
