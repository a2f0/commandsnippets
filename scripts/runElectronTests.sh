#!/bin/sh
set -eu

script_directory=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
cd "$(dirname "$script_directory")/frontend"

if [ "$(uname -s)" = Darwin ] && [ -z "${CSC_IDENTITY_AUTO_DISCOVERY:-}" ]; then
  CSC_IDENTITY_AUTO_DISCOVERY=false
  export CSC_IDENTITY_AUTO_DISCOVERY
fi

echo "Building Electron app"
pnpm run electron:dist

echo "Checking Electron build output"
find dist-electron -type f -print | sed -n '1,10p'
if [ -d dist-electron/linux-unpacked ]; then
  ls -la dist-electron/linux-unpacked
fi

echo "Running Electron tests"
if [ "$(uname -s)" = Linux ] && command -v xvfb-run >/dev/null 2>&1; then
  exec xvfb-run -a pnpm run electron:test -- "$@"
fi

exec pnpm run electron:test -- "$@"
