#!/bin/sh

# Bump the version
npm version patch --git-tag-version=false

# Get the current version from package.json
VERSION=$(node -p "require('./package.json').version")

echo "Version bumped to $VERSION"

git add package.json
git add package-lock.json
git add version_bump.sh

git commit -m "chore: bump version to $VERSION"
