#!/bin/bash
terraform --version
terraform destroy --var-file=main.tfvars -auto-approve
