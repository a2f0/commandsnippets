# Commandsnippets

Monorepo for the Commandsnippets app.

| Path | What |
|---|---|
| `packages/frontend/` | React web client; pnpm, own lockfile |
| `packages/backend-v2/` | Cloudflare Workers API; bun, own lockfile |
| `packages/agent-tool/` | CLI behind the ship/review skills (root bun workspace) |
| `backend/` | Django API (being replaced by `packages/backend-v2/`) |
| `scripts/` | git hooks, CI policy, test entrypoints |
| `terraform/` | Cloudflare DNS records for the domain |

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
