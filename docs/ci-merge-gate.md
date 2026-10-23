# CI and merge requirements

The `protect-main` GitHub ruleset requires the `CI gate` check from the GitHub
Actions app, with strict base freshness, squash-only merges, signed commits, and
no bypass actors. The ruleset is repository configuration; editing a workflow
alone does not make a check required.

`CI gate` (`.github/workflows/ci.yml`) runs on every pull request. A `changes`
job decides which lanes apply (`scripts/checks/ciPolicy.ts`), and the gate then
requires each lane to have succeeded, or to have been skipped *because* change
detection marked it irrelevant. A failed, cancelled, missing, or unexpectedly
skipped lane fails the gate. Changes to a workflow, to the CI policy itself
(`scripts/checks/ci*`), or to the root `.mise.toml`, `package.json` or `bun.lock` exercise
every lane.

The gate always checks managed skill drift and lints the actual PR title with
commitlint, including on documentation-only PRs. It evaluates the local
`scripts/checks/ciGate.json` policy through `agent-tool ci gate`; path-to-lane
classification remains repository-owned.

| Lane | Workflow | Scope |
|---|---|---|
| `tooling` | inline in `ci.yml` | `scripts/`, managed skills, tooling config |
| `backend-v2` | `backend-v2.yml` (Backend v2 CI) | `packages/backend-v2/`, `packages/api-shared/` |
| `api-shared` | `api-shared.yml` (API Shared CI) | `packages/api-shared/` |
| `frontend` | `frontend.yml` (Frontend CI) | `packages/frontend/`, `packages/api-shared/`, app test scripts |
| `website` | `website.yml` (Website CI) | `packages/website/` |
| `terraform` | `terraform.yml` (Terraform CI) | `terraform/` |

`packages/api-shared/` is the API contract its consumers build against, so a
change there also runs the lanes of its consumers: `backend-v2` and
`frontend`.

The application workflows are reusable (`workflow_call`) and keep their manual
dispatch entry points. They no longer run on pull requests or feature-branch
pushes themselves; `Frontend CI` and `Backend v2 CI` still run on pushes to
`main` and `staging`. `Backend v2 CI` has a deploy job for those pushes, but
it is off: it runs only once the `BACKEND_V2_DEPLOY` repository variable is
`true` and the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets
exist. Without that configuration deploys run by hand; see
[backend deployment](../packages/backend-v2/README.md#deployment). Inspect the
current variable and secret names before shipping. The job also checks
`github.workflow`, because a reusable workflow sees its caller's context, so a
`CI` run can never deploy.

Require the aggregate gate rather than individual path-filtered workflows:
GitHub leaves checks from skipped workflows pending, while skipped jobs count as
passing.

The `agent-tool.json` merge policy independently requires a successful
`CI gate` on the exact head it will merge and rejects any other reported failed
or pending check. Missing checks and API errors stop the merge.

## Adding a lane

1. Add the job to `ci.yml`, gated on `needs.changes.outputs.<scope>`.
2. Add `<scope>` and its path pattern to `CI_SCOPES` in `ciPolicy.ts`, and the
   output to the `changes` job.
3. Map the job id to its scope in `scripts/checks/ciGate.json`, with `changes`
   as its source. The policy test keeps its outputs aligned with `CI_SCOPES`.
4. Add the job to the gate's `needs`.

## Local hooks

Run `bun install && bun run hooks:install` once per checkout. The hooks live in
`scripts/git/hooks/`; `agent-tool hooks install --apply` copies the files
declared by `agent-tool.json` and tracks ownership in the Git hooks directory.
It preserves unrelated hooks and backs up replaced managed files. For an
existing installation from the old installer, inspect `bun run hooks:check`,
then migrate once with `bun run hooks:install -- --adopt`. Normal future installs
do not need adoption. The `reset` skill re-runs documented setup so merged hook
changes take effect. `bun run hooks:check` reports missing or stale copies.

- `commit-msg` rejects attribution using `agent-tool commits check --message-file`
  and lints the unchanged message with the full local commitlint configuration.
- `pre-push` validates every pushed branch destination using
  `agent-tool branch check --pre-push`, rejects unsigned/bad signatures and
  `Co-authored-by` trailers with `agent-tool commits check --range`, and runs the
  checks for the areas the push touches. Those checks run against the
  worktree, so the hook first requires the pushed commit to be the checked-out
  `HEAD`, with no uncommitted tracked changes and no untracked files under the
  checked paths. A change to `packages/api-shared/` installs and checks it, then
  reinstalls and checks `packages/backend-v2/`, which bundles it. It refuses to
  run when the installed copy is stale. Per-check timings are logged under
  `.git/commandsnippets/pushGateTimings.tsv`
  (`scripts/git/showPushGateTimings.sh`).

A co-author trailer that reaches `pre-push` is rejected; reword the commit and
review the new HEAD before shipping. Signature policy requires presence and
rejects provably bad signatures; it does not require every public key to be
locally trusted. SSH-signed commits need `gpg.ssh.allowedSignersFile` configured
when Git would otherwise report them as unsigned.

## Shared shipping commands

Use the managed skills in `.agents/skills/` and `.claude/skills/` with the
exact-pinned package. `agent-tool.json` declares conventional types (including
`cleanup`), a 50-character header/branch limit, `main`/`staging` exemptions,
the `CI gate` check in workflow `CI`, and strict ruleset freshness. Commitlint
retains its complete local rules for commits and PR titles. Changed frontend
and backend-v2 packages receive the patch bumps configured under `versions`;
their independent lockfiles stay with their package.

Use `agent-tool pr checks --wait --head <reviewed-sha>` to wait for every check
entry, `pr preflight` before the guarded merge, and `repo cleanup` after the
confirmed merge. The managed skills document the procedure; this document owns
the repository-specific policy. After cleanup, reinstall dependencies and hooks
when changed. A merge that triggers Backend v2 CI must have its deployment
result checked separately from the successful PR merge.
