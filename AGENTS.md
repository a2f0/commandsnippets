# Commandsnippets

Monorepo for the Commandsnippets app.

| Path | What |
|---|---|
| `packages/frontend/` | React web client; bun (Vite and Vitest on Node), own lockfile |
| `packages/backend-v2/` | Cloudflare Workers API; bun, own lockfile |
| `packages/api-shared/` | The API contract: zod schemas and types shared by the API and its clients; bun, own lockfile |
| `packages/website/` | Public website (Astro); bun, own lockfile |
| `packages/agent-tool/` | CLI behind the ship/review skills (root bun workspace) |
| `scripts/` | git hooks, CI policy, test entrypoints |
| `docs/` | CI merge gate and dependency update guidance |
| `terraform/` | Cloudflare zone and databases (Terraform stacks, state in R2) |

## Conventions

- Commits and PR titles are conventional commits, header ≤50 chars
  (`commitlint.config.mts`). Branches are `<type>/<name>` with the same types
  (`bun run lint:branch-name`).
- Commits are signed and carry no `Co-authored-by` trailers; the `commit-msg`
  hook strips Claude's, and `pre-push` rejects any left. Install the hooks with
  `bun install && bun run hooks:install`.
- `main` is protected: changes land through squash-merged PRs that pass
  `CI gate` (see `docs/ci-merge-gate.md`).
- Ship work with the `ship-pr` skill (`.claude/skills/`, `.codex/skills/`):
  commit, cross-agent review and repair, open the PR, squash-merge, reset.
- Capture noisy finite checks, installs, builds, and hook-running pushes with
  `bun run agent:run --label <check> -- <command> [args...]`. The exact pinned
  `@a2f0/agent-tool` keeps full private logs and preserves exit status while
  returning a compact receipt and a bounded failure excerpt. Use
  `node_modules/.bin/agent-tool logs <log-path>` or targeted searches to inspect
  required warnings, coverage, timings, and artifacts before accepting a check.
  Keep review findings, version decisions, audits, and other structured decision
  output visible. Run interactive tools and persistent servers directly.
  The repository-owned `packages/agent-tool` still owns review, PR, versioning,
  and merge policy; the published tool supplies command capture only.

## Dependency documentation

Read [dependency maintenance](docs/dependencies.md) before upgrades. Keep reusable
procedures and active constraints there, reconciling entries in place and removing
resolved ones. Put run-specific inventories, audits, validation, previews, and
skipped-group evidence in the upgrade PR. Keep README focused on setup and normal
usage with a short maintenance link, without upgrade reports or duplicated agent
instructions.

## Review focus

Flag as blocking: security issues (auth, data exposure across users, secrets in
code or logs), behavior changes to the public API that clients depend on, data
loss or migration hazards, and missing tests for new behavior. Keep findings to
one line each with a `file:line` reference.
