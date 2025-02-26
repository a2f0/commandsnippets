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
    ./destroy.sh

    ./apply.sh
    <login via ssh to add key to ~/.ssh/known_hosts>
    cd ../ansible
    ./staging.sh
    <login via ssh>
    <copy environment variables to .env>
    cd ~/tearleads-backend
    ./deploy-containers.sh




