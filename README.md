# Overview

Tearleads automation.

Secrets in this repo are managed by [SOPS](https://github.com/getsops/sops)
using the GPG recipient configured in `.sops.yaml`. Encrypted files use the
`.sops` suffix and are stored in SOPS binary mode so their decrypted contents
are byte-for-byte compatible with the original Terraform, YAML, and SSH key
files.

Terraform and Ansible scripts decrypt the file they need into an automatically
cleaned temporary file. A persistent plaintext copy is not required.

## Development

Bootstrap
    ansible-galaxy install -r ansible/requirements.yaml
    brew install gnupg sops
    npm install
    pip install pre-commit
    pre-commit install
    pre-commit install --hook-type commit-msg

Configure environment variables
    export AWS_ACCESS_KEY_ID=`<key>`
    export AWS_SECRET_ACCESS_KEY=`<secret access key>`

Linting
    npm run commitlint -- --from origin/production --to HEAD
    terraform fmt --recursive
    tflint --recursive
    tflint --recursive --fix

Upgrading
    upgrade version in `versions.tf` file
    terraform init -upgrade
    ./apply.sh

### Secrets

Edit an encrypted file directly:

    sops edit --input-type binary --output-type binary production/main.tfvars.sops

Decrypt a file that must persist locally, such as an SSH key:

    umask 077
    sops decrypt --input-type binary --output-type binary \
      --output ssh_keys/tearleads-backend-deploy-key \
      ssh_keys/tearleads-backend-deploy-key.sops

Remove the plaintext file when it is no longer needed. Plaintext secret paths
are ignored by Git, but encrypted `.sops` files must be committed.

When adding or removing GPG recipients, update `.sops.yaml`, then synchronize
each encrypted file with:

    sops updatekeys path/to/file.sops

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
