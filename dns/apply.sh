#!/bin/bash
set -e

export GOOGLE_CLOUD_KEYFILE_JSON=./service-account.json
terraform --version
terraform apply --var-file=main.tfvars --auto-approve
