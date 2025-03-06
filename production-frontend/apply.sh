#!/bin/bash
set -e
terraform --version
terraform apply --var-file=main.tfvars
