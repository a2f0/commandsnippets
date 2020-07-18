#!/bin/bash
set -e
START=`date +%s`

# Login to Docker (aws v2 cli)
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
$DIR/ecr-login-aws-v2.sh

docker-compose -f container-registry.yaml pull
docker-compose -f container-registry.yaml down
docker-compose -f container-registry.yaml run python manage.py migrate
docker-compose -f container-registry.yaml up -d