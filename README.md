# Command Snippets

Command Snippets is a command snippet tool for programmers and system
administrators: snippets are tagged, and both tags and snippets can be put in
a user-defined order. This repo is available on the web at
<https://commandsnippets.com>. The web app runs at
<https://app.commandsnippets.com> and its API at
<https://api.commandsnippets.com>.

This repository contains the application and its infrastructure as a monorepo.
Each directory retains the commit history of its original repository.

## Quick start

Install [mise](https://mise.jdx.dev/getting-started.html) and activate it in
your shell, then run these commands from the repository root:

```sh
mise install
bun install --frozen-lockfile
bun run hooks:install

# The API, on http://localhost:9001
cd packages/backend-v2
bun install --frozen-lockfile
cp .dev.vars.example .dev.vars   # fill in OAuth client ids/secrets
bun run db:migrate:local
bun run dev

# The web app, on http://localhost:8085 (in a second terminal, from the root)
cd packages/frontend
bun install --frozen-lockfile
bun run dev
```

The root `.mise.toml` pins Bun and Node for every package and for CI. Bun
installs dependencies and runs scripts; tools such as Vite, Vitest, WebdriverIO
and Wrangler continue to execute on Node. The root install holds the shared
tooling, and each application package keeps its own lockfile: run
`bun install --frozen-lockfile` in the package you work on.

## Layout

| Directory | Contents |
| --- | --- |
| [`packages/api-shared/`](packages/api-shared/README.md) | API contract (zod schemas) shared by the API and its clients |
| [`packages/backend-v2/`](packages/backend-v2/README.md) | Cloudflare Workers API |
| [`packages/frontend/`](packages/frontend/README.md) | Web client |
| [`packages/website/`](packages/website/README.md) | Public website (Astro) |
| `assets/brand/` | Shared selection styles and SVG sources for the logo, web icons and link-preview image |
| [`scripts/`](scripts/README.md) | Repository checks, tracked hooks, and test launchers |
| `docs/` | CI merge gate, click tracking, and dependency update guidance |
| [`terraform/`](terraform/README.md) | Cloudflare zone and databases (Terraform stacks, state in R2) |

## Checks

These root entrypoints run the frontend's tests with the commands GitHub
Actions uses; install the frontend dependencies first:

```sh
bun run test:unit      # Vitest
bun run test:browser   # headless WebdriverIO suite (Chrome)
```

`bun run check` runs the root shell lint, typechecking, script tests, and
managed-skill checks. Each package README documents its own checks and, for
the deployed packages, their deployment.

## Documentation

- [CI and merge requirements](docs/ci-merge-gate.md): the `CI gate` lanes,
  local hooks and their migration, and deploy conditions.
- [Dependency maintenance](docs/dependencies.md): update boundaries, supported
  tool combinations, and deployment previews.
- [Click tracking](docs/click-tracking.md): the analytics the deployed website
  and web app send, per environment.
