# CI and merge requirements

The `protect-main` GitHub ruleset requires the `CI gate` check from the GitHub
Actions app, squash-only merges, signed commits, and no bypass actors. It does
not require a branch to be up to date with `main`: a pull request whose `CI
gate` passed merges after `main` moves, unless GitHub reports a conflict. The
ruleset is repository configuration; editing a workflow alone does not make a
check required.

`CI gate` (`.github/workflows/ci.yml`) runs on every pull request and every
push to `main`. A `changes` job decides which lanes apply
(`scripts/checks/ciPolicy.ts`), and the gate then requires each lane to have
succeeded, or to have been skipped *because* change detection marked it
irrelevant. A failed, cancelled, missing, or unexpectedly skipped lane fails
the gate. Changes to a workflow or to the setup action every job uses
(`.github/actions/setup`), to the CI policy itself (`scripts/checks/ci*`), to
the root `.mise.toml` or `mise.lock`, to the workspace install files every
package shares (the root `package.json`, `bunfig.toml` and `bun.lock`), or to
the root `biome.json` and `knip.config.ts` every package's lint reads exercise
every lane, and so does a push to `main`, which has no pull request diff.

Two pull requests that pass separately can break `main` together; that is
accepted, and `main`'s own CI shows it: every lane runs on each push there, so
the latest run checks the whole tree its merges combined into. The `ship-pr`
skill starts from `agent-tool repo base-health`: a red `main` is repaired, with
the test that would have caught the combination, before or alongside the
requested change.

The gate always checks managed skill and permission-rule drift, rejects
committed binary files (`agent-tool checks binaries`), and lints the actual PR
title with commitlint, including on documentation-only PRs. It
evaluates the local `scripts/checks/ciGate.json` policy through
`agent-tool ci gate`; path-to-lane classification remains repository-owned.

| Lane | Workflow | Scope |
| --- | --- | --- |
| `tooling` | inline in `ci.yml` | `scripts/`, `packages/frontend/scripts/`, `terraform/scripts/*.ts` (root typecheck), managed skills and permission rules, tooling config, Markdown (root lint) |
| `backend-v2` | `backend-v2.yml` (Backend v2 CI) | `packages/backend-v2/`, `packages/api-shared/` |
| `api-shared` | `api-shared.yml` (API Shared CI) | `packages/api-shared/` |
| `frontend` | `frontend.yml` (Frontend CI) | `packages/frontend/`, `packages/api-shared/`, app test scripts, `assets/brand/`, `agent-tool.json`, `.ls-lint.yml` |
| `website` | `website.yml` (Website CI) | `packages/website/`, `assets/brand/`, `agent-tool.json` |
| `terraform` | `terraform.yml` (Terraform CI) | `terraform/` |

`packages/api-shared/` is the API contract its consumers build against, so a
change there also runs the lanes of its consumers: `backend-v2` and
`frontend`. Both web packages render their icons from the brand sources in
`assets/brand/` with the `images` settings in `agent-tool.json`, using the
root's pinned agent-tool, so those paths run the `frontend` and `website`
lanes (and, in the push gate, the website's lint and typecheck). Every job
checks the repository out, then sets up with `.github/actions/setup`: the
pinned mise installs the Bun and Node versions in `.mise.toml`, and every
application lane runs one `bun install --frozen-lockfile`, which installs the
whole workspace, root tooling included, from the root `bun.lock`; the
`tooling` lane and the gate install only the root workspace (`--filter
commandsnippets`), and change detection and the `terraform` lane install
nothing.

The application workflows are reusable (`workflow_call`) and keep their manual
dispatch entry points. They do not run on pull requests or on pushes to `main`
or feature branches themselves, so `CI` runs each lane once per push to `main`.
`Frontend CI` keeps its own push trigger for `staging` alone, with path filters
that include the root workspace install files. `Backend v2 CI` runs on every
push to `staging`, so that branch's tip, like `main`'s, always has a run that
can deploy it.

`Backend v2 CI` has a deploy job, which needs the workflow's `test` job (lint,
typecheck, and both coverage suites), so a push that breaks the backend fails
before it ships. It deploys production from `CI` on a push to `main`, which
sets the workflow's `deploy` input, and staging from `Backend v2 CI`'s own run
on a push to `staging`; it never runs for a pull request or a manual run. The
job checks `github.workflow` for staging, because a reusable workflow sees its
caller's context. Every lane runs on each push to `main`, so production
deploys on every merge, not only on merges that change the backend: nearly
every merge already changes the root `bun.lock`, and redeploying the same code
and reapplying D1 migrations already applied change nothing. A failed deploy
fails that push's `CI gate`, as it failed `Backend v2 CI` before.

Deploys never overlap and never ship older code over newer. The runs that
deploy queue as they start, one at a time per branch: `CI` for pushes to
`main`, and `Backend v2 CI` for its own pushes to `staging` (their
`concurrency` settings). Neither cancels a run that has started; a pull
request's new run still cancels its older one, and manual runs never wait. A
queue cannot promise push order, since a run can start late or be rerun, so
inside its run the deploy first checks that its commit is still the tip of its
branch (`scripts/checks/ciBranchTip.sh`). A run that a newer push superseded
passes without deploying, and the newer push's run deploys the tree that
includes it. GitHub keeps one waiting run per concurrency group, so a push that
lands while another push's run waits replaces it: the replaced run shows as
cancelled and leaves its commit without a `CI gate` result. When merges
cluster, `main`'s CI takes longer to report, and only the latest of them gets
a run of its own. Rerunning an older run while a newer one waits replaces the
newer one too; rerun the newest run afterwards, or its commit stays undeployed
until the next push.

The deploy is off: it runs only once the `BACKEND_V2_DEPLOY` repository
variable is `true` and the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`
secrets exist. Without that configuration deploys run by hand; see
[backend deployment](../packages/backend-v2/README.md#deployment). Inspect the
current variable and secret names before shipping.

Frontend browser acquisition runs independently of the application browser specs;
both jobs are required. For a diagnosed transient download-host failure, retain
the failed log and rerun the complete applicable workflow once on the same commit.
Do not bypass acquisition, weaken the cold/warm assertions, or treat a focused
retry as full recovery. A second failure needs investigation, not a retry loop.

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
- `pre-push` is agent-tool's push gate, the exact output of
  `agent-tool push-gate hook`. It runs agent-tool's trust guards (installed
  hooks, managed skills and permission rules, branch names, commit signatures
  and attribution, and binary files) on exactly the commits the push adds, then
  the steps `pushGate` declares in `agent-tool.json`, and stops at the first
  failure.

The declared steps are static checks only: the lint and typecheck of each CI
lane a push changes, except `frontend`'s, and `terraform fmt -check` for
Terraform. Tests, builds, coverage, and dependency installs run in CI, which is
the authority; `agent-tool push-gate check` rejects a step that reaches a test
runner or an install, and `scripts/checks/hooks.test.ts` runs it. Each step
first asks `scripts/checks/pushScope.ts` whether its lane applies. It
classifies the pushed commits with CI's policy (`ciPolicy.ts`), from the
remote's old tip, or for a new branch from where it left `main`, so a change
that runs every lane in CI (a workflow or the setup action, the CI policy,
`.mise.toml`, `mise.lock`, the workspace install files or the root lint
configs) runs every step. The checks read the working tree, so a step refuses
when a pushed ref is not the checked-out `HEAD`, when a tracked file has
uncommitted changes (checked before the policy loads, so an uncommitted edit to
it cannot decide what runs), or when an untracked file sits in a lane it
checks. `agent-tool runs list` shows each push's step timings, and the gate
warns when a push takes longer than its 60-second budget. When CI fails after
a push, read the failing job with `agent-tool pr logs --head <sha>` and push a
reviewed fix to the same branch.

A co-author trailer that reaches `pre-push` is rejected; reword the commit and
review the new HEAD before shipping. Signature policy requires presence and
rejects provably bad signatures; it does not require every public key to be
locally trusted. SSH-signed commits need `gpg.ssh.allowedSignersFile` configured
when Git would otherwise report them as unsigned.

## Shared shipping commands

Use the managed skills in `.agents/skills/` and `.claude/skills/` with the
exact-pinned package. `agent-tool.json` declares conventional types (including
`cleanup`), a 50-character header/branch limit, `main`/`staging` exemptions,
the `CI gate` check in workflow `CI`, and the push gate's steps. It leaves
`merge.requireStrictBaseFreshness` unset, so `pr checks --wait` and `pr merge`
accept a `main` that moved during CI; only a conflict, or a `versions check`
that fails against the live base, sends a branch back to integrate it.
Commitlint retains its complete local rules for commits and PR titles. Changed
frontend and backend-v2 packages receive the patch bumps configured under
`versions`, which records their new versions in the root `bun.lock`.

Start with `agent-tool repo base-health` (see above). Use
`agent-tool pr checks --wait --head <reviewed-sha>` to wait for every check
entry, `pr preflight` before the guarded merge, and `repo cleanup` after the
confirmed merge. The managed skills document the procedure; this document owns
the repository-specific policy. After cleanup, reinstall dependencies and hooks
when changed. While the backend deploy is on, check the deploy in the merge
commit's `CI` run on `main` separately from the successful PR merge.
