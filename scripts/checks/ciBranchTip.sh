#!/bin/sh
# Whether this run's commit ($GITHUB_SHA) is still the tip of the branch it was
# pushed to ($GITHUB_REF) on origin: appends `current=true` or `current=false`
# to $GITHUB_OUTPUT. backend-v2's deploy asks once its tests pass, before it
# queues for the deploy lock, and again once it holds the lock, so a run that a
# newer push superseded deploys nothing; the newer push's run deploys its code.
# Fails, rather than answering, when origin cannot be read.
# See docs/ci-merge-gate.md.
set -eu

case "$GITHUB_REF" in
  refs/heads/?*) ;;
  *)
    echo "Not a branch: $GITHUB_REF" >&2
    exit 1
    ;;
esac

refs=$(git ls-remote origin "$GITHUB_REF")
tip=$(printf '%s\n' "$refs" | awk -v ref="$GITHUB_REF" '$2 == ref { print $1 }')
if [ -z "$tip" ]; then
  echo "origin has no $GITHUB_REF" >&2
  exit 1
fi

if [ "$tip" = "$GITHUB_SHA" ]; then
  echo "$GITHUB_SHA is the tip of $GITHUB_REF."
  echo 'current=true' >>"$GITHUB_OUTPUT"
else
  echo "$GITHUB_REF has moved on to $tip; that push's run deploys instead of $GITHUB_SHA."
  echo 'current=false' >>"$GITHUB_OUTPUT"
fi
