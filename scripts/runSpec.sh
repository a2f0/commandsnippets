#!/bin/sh
# This script runs a single test using wdio.
pnpm start-server-and-test server-test http-get://localhost:8081 "npx wdio test/wdio.shared.conf.ts --spec $1"
