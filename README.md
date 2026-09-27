# CommandSnippets

This repository contains the CommandSnippets application and infrastructure as
a monorepo.

| Directory | Contents |
| --- | --- |
| `backend/` | Django API (being replaced by `packages/backend-v2/`) |
| `packages/agent-tool/` | CLI behind the ship/review skills |
| `packages/backend-v2/` | Cloudflare Workers API |
| `packages/frontend/` | Web client |
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
```

Backend tests expect PostgreSQL on `localhost:5432` by default. Override the
standard `POSTGRES_*` variables to use another test database.
