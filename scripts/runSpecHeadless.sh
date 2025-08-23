#!/bin/sh
# This script runs a single test using wdio headless.
if [ -z "$1" ]; then
    echo "Usage: $0 <spec-file>"
    echo "Example: $0 test/specs/tags/search.spec.ts"
    exit 1
fi

pnpm start-server-and-test server-test http-get://localhost:8081 "npx wdio test/wdio.headless.conf.ts --spec $1"
