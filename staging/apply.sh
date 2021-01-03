#!/bin/bash
set -e

/usr/local/opt/terraform/bin/terraform apply --var-file=main.tfvars
