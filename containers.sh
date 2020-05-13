#!/bin/bash
set -e
START=`date +%s`
echo "=== Building container."
. ./.env
echo "=== AWS_REGION: $AWS_REGION"
echo "=== ECR_FQDN: $ECR_FQDN"
echo "=== ECR_REPOSITORY: $ECR_REPOSITORY"
docker build --no-cache . -f compose/django/Dockerfile-prod -t tearleads-backend:latest

# echo "=== Logging into repository: $ECR_FQDN"
# Login to Docker (aws v2 cli)
aws ecr get-login-password \
    --region $AWS_REGION \
| docker login \
    --username AWS \
    --password-stdin $ECR_FQDN

echo "=== Tagging image: $ECR_FQDN/$ECR_REPOSITORY:tearleads-backend-latest"
docker tag tearleads-backend $ECR_FQDN/$ECR_REPOSITORY:tearleads-backend-latest

echo "=== Pushing image"
docker push $ECR_FQDN/$ECR_REPOSITORY:tearleads-backend-latest

END=`date +%s`
RUNTIME=$((END-START))
echo "=== Runtime: $RUNTIME"