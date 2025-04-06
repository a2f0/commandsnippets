#!/bin/sh
set -e

# Extract version from package.json
VERSION=$(grep -o '"version": "[^"]*"' package.json | cut -d'"' -f4)

# Update the HTML file with the version as a data attribute
# Using a portable approach for macOS and Linux
if [ "$(uname)" = "Darwin" ]; then
  # macOS requires an extension argument (can be empty)
  sed -i '' "s/<html data-version=\"[^\"]*\"/<html data-version=\"$VERSION\"/" index.html
else
  # Linux
  sed -i "s/<html data-version=\"[^\"]*\"/<html data-version=\"$VERSION\"/" index.html
fi

echo "Added version $VERSION to index.html"
