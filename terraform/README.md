# Terraform

Cloudflare configuration for `commandsnippets.com`. State lives in Cloudflare
R2 (bucket `commandsnippets-terraform-state`), so nothing here needs AWS.

## Layout

```
modules/
  zone/            zone-wide settings, DNS records, www redirect
  environment/     one deployment's D1 database
stacks/
  zone/            commandsnippets.com (shared by every environment)
  staging/         module "environment" for staging
  production/      module "environment" for production
scripts/tf         runs Terraform for one stack with the SOPS credentials
secrets.env.sops   the scoped Cloudflare token and the R2 state keys
```

A stack is a root module with its own state (`<stack>/terraform.tfstate` in
R2), provider lock file and backend. Modules hold the resources; stacks only
say which environment gets what.

| Stack | Manages |
|---|---|
| `zone` | Zone settings (strict SSL, always HTTPS, TLS 1.2+), the Google site verification TXT record, CAA records for Cloudflare's CAs, and the `www` → apex redirect |
| `staging` | The `commandsnippets-staging` D1 database |
| `production` | The `commandsnippets-production` D1 database |

Not managed here, on purpose:

- **Worker code, secrets and hostnames.** Each package's `wrangler.jsonc` lists
  its custom domains (`api-staging`, `app-staging`, `website-staging`, and the
  production hosts) and `wrangler deploy` attaches them; Cloudflare's custom
  domains API does not accept this stack's scoped token. Secrets are set with
  `wrangler secret bulk`, so their values never enter Terraform state.
- **The R2 state bucket** itself, bootstrapped once before any state existed.

Staging hostnames are hyphenated first-level names because the zone's
Universal SSL certificate covers only one level below the apex.

## Usage

Prerequisites: Terraform (`.terraform-version`), SOPS with the GPG key for
`../.sops.yaml`, and tflint.

```shell
scripts/tf zone init
scripts/tf staging plan
scripts/tf production apply
```

`scripts/tf <stack> <arguments...>` decrypts `secrets.env.sops` into the
Terraform process's environment only:

| Variable | Used by |
|---|---|
| `CLOUDFLARE_API_TOKEN` | The Cloudflare provider: the scoped user token `commandsnippets-terraform` (DNS, Zone Settings, Zone Read and Single Redirects on this zone; D1 on the account). |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | The S3 backend, pointed at R2: the token `commandsnippets-terraform-state`, limited to the state bucket. The key ID is the token ID and the secret its SHA-256. |

Edit the secrets with:

    sops edit --input-type dotenv --output-type dotenv secrets.env.sops

After changing the GPG recipients in `../.sops.yaml`, re-encrypt with
`sops updatekeys --input-type dotenv secrets.env.sops`.

## Checks

The `terraform` lane of `CI gate` runs `terraform fmt -check`, `terraform
validate` for every stack, the modules' `terraform test` suites (against a
mocked provider: the www redirect, CAA set, TXT quoting, TLS settings and D1
read replication), `tflint --recursive` with the shared `.tflint.hcl`, and shellcheck plus `bun test` for
`scripts/tf` (with fake `sops`/`terraform`: decryption failures and missing
credentials stop it, inherited credentials never reach Terraform). The pre-push
hook runs the format check and the wrapper tests. Locally:

```shell
terraform fmt -recursive
tflint --init && tflint --recursive --config="$PWD/.tflint.hcl"
(cd modules/zone && terraform init -backend=false && terraform test)
bun test ./scripts/
```

Dependabot proposes provider updates for each stack's lock file.

## Adding an environment

Copy `stacks/staging`, change the backend `key` and the database name, and add
the environment's custom domains to each package's `wrangler.jsonc`. Existing
resources (such as a D1 database created with wrangler) are adopted with an
`import` block, as `stacks/staging/main.tf` does.
