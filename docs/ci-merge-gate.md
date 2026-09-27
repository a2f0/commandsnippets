# CI and merge requirements

The `protect-main` GitHub ruleset requires the `CI gate` check from the GitHub
Actions app, with strict base freshness, squash-only merges, signed commits, and
no bypass actors. The ruleset is repository configuration; editing a workflow
alone does not make a check required.

`CI gate` (`.github/workflows/ci.yml`) runs on every pull request. A `changes`
job decides which lanes apply (`scripts/checks/ciPolicy.ts`), and the gate then
requires each lane to have succeeded, or to have been skipped *because* change
detection marked it irrelevant. A failed, cancelled, missing, or unexpectedly
skipped lane fails the gate. Workflow, `package.json`, and `bun.lock` changes
exercise every lane.

| Lane | Workflow | Scope |
|---|---|---|
| `tooling` | inline in `ci.yml` | `packages/`, `scripts/`, tooling config |
| `backend` | `backend.yml` (Backend CI) | `backend/`, API deploy/test scripts |
| `backend-v2` | `backend-v2.yml` (Backend v2 CI) | `backend-v2/` |
| `frontend` | `frontend.yml` (Frontend CI) | `frontend/`, app deploy/test scripts |
| `ios` | `frontend-ios-testing.yml` | `frontend/`, `runCapacitorTests.sh` |

The Android workflow (`frontend-android-testing.yml`) is **not** a lane for
now: it has failed on every run since mid-August (AVD creation, and SDK setup on
current runner images). It stays runnable by hand; once fixed, add it back as a
`mobile` job in `ci.yml` and `CI_JOBS`.

The application workflows are reusable (`workflow_call`) and keep their manual
dispatch entry points. They no longer run on pull requests or feature-branch
pushes themselves; `Backend CI` and `Frontend CI` still run on pushes to `main`
and `staging`, where they deploy. Their deploy jobs check
`github.workflow`, because a reusable workflow sees its caller's context, so a
`CI` run can never deploy.

Require the aggregate gate rather than individual path-filtered workflows:
GitHub leaves checks from skipped workflows pending, while skipped jobs count as
passing.

The `agent-tool` squash-merge helper independently requires a successful
`CI gate` on the exact head it will merge and rejects any other reported failed
or pending check. Missing checks and API errors stop the merge.

## Adding a lane

1. Add the job to `ci.yml`, gated on `needs.changes.outputs.<scope>`.
2. Add `<scope>` and its path pattern to `CI_SCOPES` in `ciPolicy.ts`, and the
   output to the `changes` job.
3. Add the job to the gate's `needs`.

## Local hooks

Run `bun install && bun run hooks:install` once per checkout. The hooks live in
`scripts/git/hooks/` and are copied into `.git/hooks` by
`scripts/git/install-hooks.sh`; the `reset` skill re-runs the installer so a
merged hook change takes effect.

- `commit-msg` strips Claude `Co-authored-by` trailers and the "Generated with
  Claude Code" footer, then lints the message with commitlint.
- `pre-push` lints the branch name, rejects unsigned commits and any remaining
  `Co-authored-by` trailer (`scripts/checks/checkCommitTrust.sh`), and runs the
  checks for the areas the push touches. Those checks run against the
  worktree, so the hook first requires the pushed commit to be the checked-out
  `HEAD`, with no uncommitted tracked changes and no untracked files under the
  checked paths. It refuses to run when the installed copy is stale. Per-check timings are logged under
  `.git/commandsnippets/pushGateTimings.tsv`
  (`scripts/git/showPushGateTimings.sh`).

A git hook cannot rewrite the commits being pushed, so a co-author trailer that
reaches `pre-push` (e.g. from `git commit --no-verify`) is rejected with
instructions to reword the commit; the ship skills treat that message-only
rewrite as not needing a re-review. SSH-signed commits need
`gpg.ssh.allowedSignersFile` configured, or git reports them as unsigned.
