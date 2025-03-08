#!/bin/sh
set -e

# Extract version from package.json
VERSION=$(grep -o '"version": "[^"]*"' package.json | cut -d'"' -f4)

# Add version as data-id attribute to the div in index.html
# Use a more portable sed approach that works on both Linux and macOS
if [ "$(uname)" = "Darwin" ]; then
  # macOS requires an extension with -i (even if it's empty)
  sed -i '' 's/<div id="©">/<div id="©" data-version="'"$VERSION"'">/' build/index.html
else
  # Linux version
  sed -i 's/<div id="©">/<div id="©" data-version="'"$VERSION"'">/' build/index.html
fi

echo "Added version $VERSION to index.html"
