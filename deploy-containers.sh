#!/bin/bash
# Deploy containers to a frontend.
set -e
START=`date +%s`

# Login to Docker (aws v2 cli)
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
echo "=== Entering directory $DIR"
cd $DIR
echo "=== calling ecr login"
$DIR/ecr-login-aws-v2.sh
echo "=== Running git pull..."
git pull
echo "=== Pulling down containers..."
docker-compose -f container-registry.yaml pull
echo "=== Stopping compose..."
docker-compose -f container-registry.yaml down
echo "=== Running database migrations..."
docker-compose -f container-registry.yaml run backend python manage.py migrate
echo "=== Starting compose..."
docker-compose -f container-registry.yaml up -d
echo "=== Done."