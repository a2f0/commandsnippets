#!/bin/bash
set -e

export GOOGLE_CLOUD_KEYFILE_JSON=./service-account.json
/usr/local/opt/terraform/bin/terraform apply --var-file=main.tfvars --auto-approve
