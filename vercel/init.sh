#!/bin/bash
terraform --version
terraform init -backend-config=./terraform.backend -upgrade
