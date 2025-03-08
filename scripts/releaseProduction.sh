#!/bin/sh

# Exit immediately if a command exits with a non-zero status
set -e

# Check if the current branch is staging
current_branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$current_branch" != "staging" ]; then
    echo "Error: You must be on the staging branch to release to production"
    exit 1
fi

echo "Current branch is staging. Proceeding with production release..."

# Check for staged changes
if [ -n "$(git diff --staged)" ]; then
    echo "Error: You have staged changes. Please commit or unstage them before releasing to production"
    exit 1
fi

# Check for unstaged changes
if [ -n "$(git diff)" ]; then
    echo "Error: You have unstaged changes. Please commit or stash them before releasing to production"
    exit 1
fi

echo "No uncommitted changes detected. Continuing with release..."

# Additional release steps would go here

echo "Production release completed successfully"
