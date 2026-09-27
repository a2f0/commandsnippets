# CommandSnippets

This repository contains the CommandSnippets application and infrastructure as
a monorepo.

| Directory | Contents |
| --- | --- |
| `ansible/` | Server configuration and application host provisioning |
| `backend/` | Backend application and API |
| `frontend/` | Web, desktop, and mobile clients |
| `scripts/` | Local entrypoints shared with CI/CD |
| `terraform/` | Cloudflare DNS records for the domain |

Each directory retains the commit history of its original repository.

## Local CI scripts

Install the backend or frontend dependencies before running its scripts. The
test entrypoints mirror the commands used by GitHub Actions:

```sh
./scripts/runBackendTests.sh
./scripts/runUnitTests.sh
./scripts/runWebdriverTests.sh
./scripts/runElectronTests.sh
./scripts/runCapacitorTests.sh android
./scripts/runCapacitorTests.sh ios
```

Backend tests expect PostgreSQL on `localhost:5432` by default. Override the
standard `POSTGRES_*` variables to use another test database. Capacitor tests
expect a running platform emulator or simulator and the native Android or iOS
toolchain. Pass `build` or `test` after the platform to run only that phase.

The deployment wrappers also run the same build and upload or remote-deploy
steps as CI:

```sh
./scripts/deployStagingApi.sh
./scripts/deployProductionApi.sh
./scripts/deployStagingApp.sh
./scripts/deployProductionApp.sh
```

API deployments require AWS credentials, Docker Buildx, `DEPLOY_USER`, and the
matching `DEPLOY_STAGING_FQDN` or `DEPLOY_PRODUCTION_FQDN`. They use the local
SSH configuration unless `SSH_KEY` and a matching `*_KNOWN_HOSTS_BASE64` value
are provided. Pass `image` or `remote` to run only one deployment phase.

App deployments require AWS credentials and the matching `STAGING_DOMAIN` or
`PRODUCTION_DOMAIN` S3 bucket name. `DEPLOY_DOMAIN` can be used as a common
override. Pass `build` or `upload` to run only one phase. Dependencies are not
installed automatically, so deployments remain reproducible from the checked
in lockfiles without changing the working tree.
