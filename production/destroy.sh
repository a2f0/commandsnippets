#!/bin/bash
set -e
/usr/local/opt/terraform/bin/terraform destroy --var-file=main.tfvars
