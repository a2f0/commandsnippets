#!/usr/bin/env zsh
docker build . -t tearleads-frontend
docker tag tearleads-frontend us.gcr.io/tearleads/tearleads-frontend
docker push us.gcr.io/tearleads/tearleads-frontend
