#!/bin/bash
# Build and push containers.
set -e
START=`date +%s`

# Login to Docker (aws v2 cli)
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
$DIR/ecr-login-aws-v2.sh

echo "=== Building container."
. ./.env
echo "=== AWS_REGION: $AWS_REGION"
echo "=== ECR_FQDN: $ECR_FQDN"
echo "=== ECR_REPOSITORY: $ECR_REPOSITORY"
docker build --no-cache . -f compose/django/Dockerfile.prod -t tearleads-backend:latest

echo "=== Tagging image: $ECR_FQDN/$ECR_REPOSITORY:tearleads-backend-latest"
docker tag tearleads-backend $ECR_FQDN/$ECR_REPOSITORY:tearleads-backend-latest

echo "=== Pushing image"
docker push $ECR_FQDN/$ECR_REPOSITORY:tearleads-backend-latest

END=`date +%s`
RUNTIME=$((END-START))
echo "=== Runtime: $RUNTIME"
