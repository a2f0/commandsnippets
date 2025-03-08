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

# Pull the latest changes from remote staging
echo "Pulling latest changes from remote staging branch..."
git pull origin staging

echo "Staging branch updated from remote. Continuing..."

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

# Pull production changes back into staging
echo "Pulling production changes back into staging branch..."
git pull origin production

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
echo "Current version from package.json: $VERSION"

# Create PR from staging to production using GitHub CLI
echo "Creating PR from staging to production..."
gh pr create \
  --base production \
  --head staging \
  --title "Release v$VERSION to production" \
  --body "Automated release of version $VERSION to production." \

# Enable auto-merge on the PR
PR_URL=$(gh pr view --json url -q .url)
echo "Enabling auto-merge on PR: $PR_URL"
gh pr merge --auto --merge

echo "Production release PR created successfully with auto-merge enabled"


echo "Staging branch is now up-to-date with production"
