#!/bin/bash
set -e
/usr/local/opt/terraform/bin/terraform init -backend-config=./terraform.backend
