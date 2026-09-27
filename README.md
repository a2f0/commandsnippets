# CommandSnippets

This repository contains the CommandSnippets application and infrastructure as
a monorepo.

| Directory | Contents |
| --- | --- |
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
