#!/bin/sh
# This script runs a single test using wdio.
if [ -z "$1" ]; then
    echo "Usage: $0 <spec-file>" >&2
    echo "Example: $0 test/specs/basic.spec.ts" >&2
    exit 1
fi

pnpm start-server-and-test server-test http-get://localhost:8081 "npx wdio test/wdio.shared.conf.ts --spec $1"
