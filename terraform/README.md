# Overview

Terraform for the `commandsnippets.com` Cloudflare zone's domain-level records
(`dns/`): Google Workspace MX, Google site verification, and CAA. The API runs
on Cloudflare Workers (`../packages/backend-v2`), whose custom domains create their own
records.

Secrets in this repo are managed by [SOPS](https://github.com/getsops/sops)
using the GPG recipient configured in `../.sops.yaml`. Encrypted files use the
`.sops` suffix and are stored in SOPS binary mode so their decrypted contents
are byte-for-byte compatible with the original Terraform and YAML files.

Terraform scripts decrypt the file they need into an automatically cleaned
temporary file. A persistent plaintext copy is not required.

## Development

Bootstrap:

    brew install gnupg pre-commit shellcheck sops tflint
    brew tap hashicorp/tap
    brew trust --formula hashicorp/tap/terraform
    brew install hashicorp/tap/terraform
    npm ci
    tflint --init
    pre-commit install
    pre-commit install --hook-type commit-msg

Configure AWS credentials for the S3 state backend:

    export AWS_ACCESS_KEY_ID=`<key>`
    export AWS_SECRET_ACCESS_KEY=`<secret access key>`

Linting:

    pre-commit run --all-files
    npm run commitlint -- --from origin/main --to HEAD
    terraform fmt --recursive
    tflint --recursive
    tflint --recursive --fix

Upgrading Terraform providers:

    upgrade version in `versions.tf` file
    terraform init -upgrade
    ./apply.sh

### Secrets

Edit an encrypted file directly:

    sops edit --input-type binary --output-type binary dns/main.tfvars.sops

Encrypted `.sops` files must be committed; their plaintext never is.

When adding or removing GPG recipients, update `../.sops.yaml`, then synchronize
each encrypted file with:

    sops updatekeys path/to/file.sops

## DNS

    cd dns
    ./init.sh
    ./apply.sh
