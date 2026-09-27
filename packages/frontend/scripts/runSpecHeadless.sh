#!/bin/sh
# This script runs a single test using wdio in headless mode.
if [ -z "$1" ]; then
    echo "Usage: $0 <spec-file>" >&2
    echo "Example: $0 test/specs/tags/search.spec.ts" >&2
    exit 1
fi

pnpm start-server-and-test server-test http-get://localhost:8081 "npx wdio test/wdio.headless.conf.ts --spec $1"
