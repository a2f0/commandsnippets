#!/bin/bash
set -e
START=`date +%s`
echo "Building container."
docker build --no-cache . -f compose/django/Dockerfile-prod -t tearleads:latest
END=`date +%s`
RUNTIME=$((END-START))
echo "=== runtime: $RUNTIME"