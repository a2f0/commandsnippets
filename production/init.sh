#!/bin/bash
set -e
terraform --version
terraform init -backend-config=./terraform.backend
