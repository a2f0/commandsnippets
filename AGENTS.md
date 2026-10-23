# Commandsnippets

Monorepo for the Commandsnippets app.

| Path | What |
|---|---|
| `packages/frontend/` | React web client; bun (Vite and Vitest on Node), own lockfile |
| `packages/backend-v2/` | Cloudflare Workers API; bun, own lockfile |
| `packages/api-shared/` | The API contract: zod schemas and types shared by the API and its clients; bun, own lockfile |
| `packages/website/` | Public website (Astro); bun, own lockfile |
| `assets/brand/` | Brand SVG sources; `agent-tool images build` renders the web icons and the link-preview image (`images` in `agent-tool.json`) |
| `scripts/` | git hooks, CI policy, test entrypoints |
| `docs/` | CI merge gate and dependency update guidance |
| `terraform/` | Cloudflare zone and databases (Terraform stacks, state in R2) |

## Conventions

- Use the Bun and Node versions in `.mise.toml`; see README for mise setup.
- Commits and PR titles are conventional commits, header ≤50 chars
  (`commitlint.config.mts`). Branches are `<type>/<name>` with the same types
  (`bun run lint:branch-name`).
- Commits are signed and carry no `Co-authored-by` trailers; both `commit-msg`
  and `pre-push` reject attribution. Install the hooks with
  `bun install && bun run hooks:install`.
- `main` is protected: changes land through squash-merged PRs that pass
  `CI gate` (see `docs/ci-merge-gate.md`).
- Ship work with the managed `ship-pr` skill (`.agents/skills/`, `.claude/skills/`):
  commit, cross-agent review and repair, open the PR, squash-merge, reset.
- Capture noisy finite checks, installs, builds, and hook-running pushes with
  `bun run agent:run --label <check> -- <command> [args...]`. The exact pinned
  `@a2f0/agent-tool` keeps full private logs and preserves exit status while
  returning a compact receipt and a bounded failure excerpt. Use
  `node_modules/.bin/agent-tool logs <log-path>` or targeted searches to inspect
  required warnings, coverage, timings, and artifacts before accepting a check.
  Keep review findings, version decisions, audits, and other structured decision
  output visible. Run interactive tools and persistent servers directly.
  Shared commands and policy are configured in `agent-tool.json`. Do not edit
  managed skills: after changing the exact tool pin, run `bun run agents:sync`
  and commit the lockfile, skills, and `.agent-tool-skills.json` together.
- Validate root tooling with `bun run check`, which records shell lint,
  typecheck, script tests, and managed-skill checks; run every affected
  application's documented checks. Full PR-title commitlint runs in `CI gate`.
- Before each review, use `agent-tool versions prepare <base-oid>` to keep
  changed `packages/frontend` and `packages/backend-v2` one patch beyond the
  pinned base, preserving deliberate major/minor releases. Their lockfiles are
  independent; the root manifest is tooling only.
- Keep repository checks in `scripts/checks`, hooks in `scripts/git/hooks`,
  and test launchers in `scripts/testing`; see [script layout](scripts/README.md).
  Put reusable mechanics in agent-tool and application-specific policy here.
  Preserve all callers when moving a script, including package-local guidance.
- Follow [CI and merge requirements](docs/ci-merge-gate.md) for strict freshness,
  scoped checks, hook setup, timing evidence, and deploy conditions. Inspect
  unresolved review threads and reply in each original thread before resolving
  a fully addressed finding.

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
