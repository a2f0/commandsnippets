# CI and merge requirements

The `protect-main` GitHub ruleset requires the `CI gate` check from the GitHub
Actions app, with strict base freshness, squash-only merges, signed commits, and
no bypass actors. The ruleset is repository configuration; editing a workflow
alone does not make a check required.

`CI gate` (`.github/workflows/ci.yml`) runs on every pull request and every push
to `main`. A `changes` job decides which scoped jobs apply
(`scripts/checks/ciPolicy.ts`); the gate then requires each scoped job to have
succeeded, or to have been skipped *because* change detection marked it
irrelevant. A failed, cancelled, missing, or unexpectedly skipped job fails the
gate. Workflow, `package.json`, and `bun.lock` changes exercise every lane.

Require the aggregate gate rather than individual path-filtered workflows:
GitHub leaves checks from skipped workflows pending, while skipped jobs count as
passing. The older per-area workflows (`Backend CI`, `Frontend CI`, the mobile
test workflows) still run on their own paths.

The `agent-tool` squash-merge helper independently requires a successful
`CI gate` on the exact head it will merge and rejects any other reported failed
or pending check, so a red `Frontend CI` run also blocks a merge. Missing checks
and API errors stop the merge.

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
  checks for the areas the push touches. It refuses to run when the installed
  copy is stale. Per-check timings are logged under
  `.git/commandsnippets/pushGateTimings.tsv`
  (`scripts/git/showPushGateTimings.sh`).

A git hook cannot rewrite the commits being pushed, so a co-author trailer that
reaches `pre-push` (e.g. from `git commit --no-verify`) is rejected with
instructions to reword the commit; the ship skills treat that message-only
rewrite as not needing a re-review. SSH-signed commits need
`gpg.ssh.allowedSignersFile` configured, or git reports them as unsigned.
