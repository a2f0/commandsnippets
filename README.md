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

## Local CI scripts

Install the frontend dependencies before running its scripts. The test
entrypoints mirror the commands used by GitHub Actions:

```sh
./scripts/runUnitTests.sh
./scripts/runWebdriverTests.sh
```

## Compact output for agents

Install root dependencies with `bun install`, then capture noisy finite commands
with the exactly pinned `@a2f0/agent-tool` harness:

```sh
bun run agent:run --label tooling-tests -- bun run test:agent-tool
bun run agent:run --label frontend-unit -- ./scripts/runUnitTests.sh
bun run agent:run --label push -- git push -u origin HEAD
node_modules/.bin/agent-tool logs <log-path> --max-bytes 4096 --tail-lines 40
```

Commands retain their arguments, environment, working directory, stdin, and exit
status. A successful run returns a JSON receipt with duration, output size, and
the private full-log path. Failure also prints a bounded tail (4096 bytes and
40 lines by default). Inspect needed warnings, coverage, timings, and artifacts
with bounded excerpts or targeted searches; exit zero alone does not establish
that the log is warning-free. Logs may contain secrets and remain in the system
temporary directory until you remove the reported task directory or the OS
cleans it.

Use the harness for installs, checks, tests, builds, and pushes with noisy hooks.
Keep review findings and verdicts, audits, version decisions, and other
structured evidence directly visible. Interactive programs and persistent
servers run directly because captured stdout and stderr are regular files.
The existing `packages/agent-tool` continues to own reviews, version bumps, PRs,
and merges; its repository-specific policies are unchanged.
