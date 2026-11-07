# Command Snippets

Monorepo for the Command Snippets app.

| Path | What |
| --- | --- |
| `packages/frontend/` | React web client; bun workspace (Vite and Vitest on Node) |
| `packages/backend-v2/` | Cloudflare Workers API; bun workspace |
| `packages/api-shared/` | The API contract: zod schemas and types shared by the API and its clients; bun workspace |
| `packages/website/` | Public website (Astro); bun workspace |
| `assets/brand/` | Shared brand SVGs and selection styles; `agent-tool images build` renders the web icons and the link-preview image (`images` in `agent-tool.json`) |
| `scripts/` | git hooks, CI policy, test entrypoints |
| `docs/` | [CI merge gate](docs/ci-merge-gate.md), [dependency updates](docs/dependencies.md) and [click tracking](docs/click-tracking.md) |
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
- Shared commands and policy are configured in `agent-tool.json`. Do not edit
  managed skills or the harness permission rules agent-tool generates
  (`.codex/rules/agent-tool.rules` and its entries in `.claude/settings.json`):
  after changing the exact tool pin or `permissions.executables`, run
  `bun run agents:sync` and commit the lockfile, skills, rules,
  `.agent-tool-skills.json`, and `.agent-tool-permissions.json` together.
  `bun run agents:check` reports drift in either.
- Lint is enforced, never suppressed or loosened to pass. `bun run lint`
  checks and `bun run fix` writes, at the root (its scripts and configs) and
  in each package:
  - Biome: the root `biome.json` holds the shared formatter and rules, and
    every package's `biome.json` extends it. Budgets: cognitive complexity
    at most 20, functions at most 75 lines, files at most 800 (blank lines
    skipped; tests exempt); split code by responsibility to stay within
    them. No import cycles, type-only imports included.
  - Layers: the frontend's `src/lib` never imports `components`, `pages`,
    `menu` or `hooks`, and its UI reaches IndexedDB only through `lib/data`
    (`packages/frontend/biome.json`).
  - knip (`knip.config.ts` covers the root and every package): no unused
    files, exports or dependencies. Delete dead code rather than ignore it;
    configure only what a tool loads by name.
  - ls-lint (`.ls-lint.yml`): frontend file and directory names.
  - markdownlint (`.markdownlint-cli2.jsonc`): every Markdown file, at the
    root; and no committed binary files (`agent-tool checks binaries`).
  - Every manifest pins exact versions (`scripts/checks/exactPins.test.ts`;
    see [dependency maintenance](docs/dependencies.md)).
- Validate root tooling with `bun run check`, which records Biome, shell lint,
  typecheck, script tests, and managed-skill and permission-rule checks; run
  every affected application's documented checks. Full PR-title commitlint
  runs in `CI gate`.
- Before each review, use `agent-tool versions prepare <base-oid>` to keep
  changed `packages/frontend` and `packages/backend-v2` one patch beyond the
  pinned base, preserving deliberate major/minor releases. The packages are
  Bun workspaces of the root manifest, which also holds the shared tooling,
  and share its `bun.lock` and `bunfig.toml`; `versions prepare` records
  their bumped versions in that lockfile.
- Keep repository checks in `scripts/checks`, hooks in `scripts/git/hooks`,
  and test launchers in `scripts/testing`; see [script layout](scripts/README.md).
  Put reusable mechanics in agent-tool and application-specific policy here.
  Preserve all callers when moving a script, including package-local guidance.
- Follow [CI and merge requirements](docs/ci-merge-gate.md) for strict freshness,
  scoped checks, hook setup, timing evidence, and deploy conditions. Inspect
  unresolved review threads and reply in each original thread before resolving
  a fully addressed finding.

## Output capture

Run Bun tests at the root or in a workspace package through
`bun run agent-tool bun test [--cwd <package>] --log [-- args...]`, for example
`bun run agent-tool bun test --log -- ./scripts/`, and other finite, noisy
commands, such as installs, builds, linters, package scripts, and Git commands
that run hooks, through
`bun run agent:run --label <name> -- <command> [args...]`, for example
`bun run agent:run --label unit -- bun run test:unit`. Each keeps complete
output in a private log, preserves the exit status, and prints a compact
receipt, with a bounded excerpt of the log on failure. Package scripts that
add options, such as coverage gates, stay the entry points for those packages'
suites: run them with `agent:run`. Read more with
`bun run agent:logs <log-path>`, raising `--tail-lines` or `--max-bytes` as
needed, or with a targeted search of the log. A zero exit does not rule out
warnings: inspect required warnings, coverage, timings, and artifacts before
accepting a check. Run reviews, version preparation, audits, infrastructure
previews, and run-group checks such as `bun run check` directly so their
results stay visible, and run interactive tools and servers directly too. Never
narrow a suite or silence warnings to reduce output. Keep other structured
decision output visible as well.

## State machines

Make implicit state machines explicit when you write or change code: one closed
state type (a discriminated union, enum, or sealed type) carrying each state's
data, typed events, and one pure transition function, with effects run on
entering a state and async work tagged so only the current request can finish.
Follow the `explicit-state-machines` skill for what to convert, what to leave
alone, and how to prove behavior did not change; `agent-tool state-machines`
lists leads. Reviews flag new implicit machines.

Here the tag is `status` (dialog flows use `step`), and each machine exports one
pure `transition<Name>(state, event)` next to its hook or component, ending in
an `assertNever` default and tested with `it.each` transition tables; see
`components/entries/useReuseHistory.ts` and `components/analytics/analyticsRead.ts`
in `packages/frontend/src`. Loading states carry a request number. Machines
cluster in the frontend's data reads, `lib/sync`, and the File menu's restore
and data-version dialogs (`menu/file/menuItems`).

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
