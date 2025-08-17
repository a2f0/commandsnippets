#!/bin/sh
set -e

# Check if we're on a protected branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" = "staging" ] || [ "$CURRENT_BRANCH" = "production" ]; then
    echo "Error: Cannot bump version on $CURRENT_BRANCH branch"
    echo "Please switch to a development branch first"
    exit 1
fi

# Bump the version
npm version patch --git-tag-version=false

# Get the current version from package.json
VERSION=$(node -p "require('./package.json').version")

echo "Version bumped to $VERSION"

git add package.json

git commit -m "chore: bump version to $VERSION"
