#!/bin/bash
set -e
START=`date +%s`

# Login to Docker (aws v2 cli)
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
echo "=== Entering directory $DIR"
cd $DIR
echo "=== running git branch"
git branch
echo "=== running git status"
git status
echo "=== calling ecr login"
$DIR/ecr-login-aws-v2.sh
echo "=== Pulling down containers..."
docker compose -f compose-container-registry.yaml pull --quiet
echo "=== Stopping compose..."
docker compose -f compose-container-registry.yaml down --remove-orphans
echo "=== Running database migrations..."
docker compose -f compose-container-registry.yaml run --rm backend python manage.py migrate
echo "=== Starting compose..."
docker compose -f compose-container-registry.yaml up -d
echo "=== Running docker system prune..."
docker system prune --force
echo "=== Done."
