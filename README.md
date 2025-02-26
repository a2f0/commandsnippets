# Overview

Tearleads automation.

Secrets in this repo are managed by [BlackBox](https://github.com/StackExchange/blackbox).

## Devlopment

Boostrap
    ansible-galaxy install -r ansible/requirements.yaml
    pip install pre-commit
    pre-commit install

Configur environment variables
    export AWS_ACCESS_KEY_ID=<key>
    export AWS_SECRET_ACCESS_KEY=<secret access key>

## Staging

### Reconfigure / Deploy

    cd staging
   ./init.sh
   ./apply.sh
