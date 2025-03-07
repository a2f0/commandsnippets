#!/bin/bash
set -e
terraform init -backend-config=./terraform.backend -upgrade
