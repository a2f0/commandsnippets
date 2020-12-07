#!/bin/bash
set -e
START=`date +%s`
echo "=== Logging into ECR"
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
. $DIR/.env
echo "=== AWS_REGION: $AWS_REGION"
echo "=== ECR_FQDN: $ECR_FQDN"
echo "=== ECR_REPOSITORY: $ECR_REPOSITORY"

echo "=== Logging into repository: $ECR_FQDN"
# Login to Docker (aws v2 cli)
aws ecr get-login-password \
    --region $AWS_REGION \
| docker login \
    --username AWS \
    --password-stdin $ECR_FQDN
