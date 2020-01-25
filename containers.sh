#!/bin/bash
set -e
START=`date +%s`
echo "Building container."
docker build --no-cache . -f compose/django/Dockerfile-prod -t tearleads-backend:latest
docker tag tearleads-backend us.gcr.io/tearleads/tearleads-backend
docker push us.gcr.io/tearleads/tearleads-backend
END=`date +%s`
RUNTIME=$((END-START))
echo "=== runtime: $RUNTIME"