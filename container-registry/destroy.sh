#!/bin/bash
set -e
terraform --version
terraform destroy --var-file=main.tfvars
