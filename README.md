# Command Snippets

This repository contains the Command Snippets application and infrastructure as
a monorepo.

| Directory | Contents |
| --- | --- |
| `packages/api-shared/` | API contract (zod schemas) shared by the API and its clients |
| `packages/backend-v2/` | Cloudflare Workers API |
| `packages/frontend/` | Web client |
| `packages/website/` | Public website (Astro) |
| `assets/brand/` | Brand SVG sources the web packages render their icons and link-preview image from |
| `scripts/` | Repository checks, tracked hooks, and test launchers ([layout](scripts/README.md)) |
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
bun run test:unit
bun run test:browser
```

`bun run check` records root shell lint, typechecking, script tests, and
managed-skill checks. Each application README
documents its own checks and deployments. The exact-pinned `@a2f0/agent-tool`
provides shared Git and shipping commands, configured in `agent-tool.json`.
See [CI and merge requirements](docs/ci-merge-gate.md) for local hook migration
and [AGENTS.md](AGENTS.md) for agent requirements.
