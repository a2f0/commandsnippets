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
| `docs/` | the CI merge gate (`docs/ci-merge-gate.md`) |
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

## Review focus

Flag as blocking: security issues (auth, data exposure across users, secrets in
code or logs), behavior changes to the public API that clients depend on, data
loss or migration hazards, and missing tests for new behavior. Keep findings to
one line each with a `file:line` reference.
