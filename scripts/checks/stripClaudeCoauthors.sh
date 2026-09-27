#!/usr/bin/env sh

set -eu

# Removes Claude attribution from a commit message file, in place:
#   - `Co-authored-by:` trailers that name Claude or an anthropic.com address
#   - the "Generated with Claude Code" footer line
# plus any blank lines those removals leave at the end of the message.
#
# Called by the commit-msg hook so Claude co-author trailers never reach a
# commit. The pre-push hook (checkCommitTrust.sh) still rejects any
# Co-authored-by trailer that gets past this, e.g. from `--no-verify`.

[ "$#" -eq 1 ] || {
  echo "Usage: $0 <commit-message-file>" >&2
  exit 2
}

message_file=$1
stripped_file="$message_file.strip.$$"
trap 'rm -f "$stripped_file"' EXIT

awk '
  {
    lower = tolower($0)
    if (lower ~ /^[[:space:]]*co-authored-by:/ &&
        (lower ~ /claude/ || lower ~ /@anthropic\.com/)) {
      removed++
      next
    }
    if (lower ~ /generated with \[?claude code/) {
      removed++
      next
    }
    lines[++count] = $0
  }
  END {
    # Drop the blank lines a removed footer leaves behind.
    while (count > 0 && lines[count] ~ /^[[:space:]]*$/) {
      count--
    }
    for (i = 1; i <= count; i++) {
      print lines[i]
    }
    if (removed > 0) {
      printf "Stripped %d Claude attribution line(s) from the commit message.\n", removed > "/dev/stderr"
    }
  }
' "$message_file" >"$stripped_file"

cat "$stripped_file" >"$message_file"
