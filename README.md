# CommandSnippets

This repository contains the CommandSnippets application and infrastructure as
a monorepo.

| Directory | Contents |
| --- | --- |
| `packages/agent-tool/` | CLI behind the ship/review skills |
| `packages/api-shared/` | API contract (zod schemas) shared by the API and its clients |
| `packages/backend-v2/` | Cloudflare Workers API |
| `packages/frontend/` | Web client |
| `packages/website/` | Public website (Astro) |
| `scripts/` | Local entrypoints shared with CI/CD |
| `docs/` | CI merge gate and dependency update guidance |
| `terraform/` | Cloudflare zone and databases (Terraform stacks, state in R2) |

Each directory retains the commit history of its original repository.

Dependency update boundaries, supported tool combinations, and deployment
previews are documented in [docs/dependencies.md](docs/dependencies.md).

## Setup

Install [mise](https://mise.jdx.dev/getting-started.html) and activate it in your
shell, then run these commands from the repository root:

```sh
mise install
bun install --frozen-lockfile
bun run hooks:install
```

The root `.mise.toml` pins Bun and Node for every package and for CI. Bun
installs dependencies and runs scripts; tools such as Vite, Vitest, WebdriverIO
and Wrangler continue to execute on Node. Each application package keeps its
own lockfile: run `bun install --frozen-lockfile` in the package you work on.

## Local CI scripts

Install the frontend dependencies before running its scripts. The test
entrypoints mirror the commands used by GitHub Actions:

```sh
./scripts/runUnitTests.sh
./scripts/runWebdriverTests.sh
```

Coding agents follow [AGENTS.md](AGENTS.md) for setup, compact command output,
and the repository-owned review and shipping workflow.
