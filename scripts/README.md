# Repository scripts

Use package scripts as the normal entrypoints. Shared branch, commit, hook,
review, and PR mechanics come from the exact-pinned `@a2f0/agent-tool`;
`agent-tool.json` holds this repository's policy.

| Group | Purpose and entrypoints |
| --- | --- |
| `checks/` | Path classification for CI and the push gate's scoped steps (`pushScope.ts`), PR-title commitlint, exact dependency pins, and policy tests; `bun run test:scripts` |
| `git/hooks/` | The commit-message hook and agent-tool's push gate (`pre-push`, declared under `pushGate` in `agent-tool.json`); `bun run hooks:install` / `bun run hooks:check` |
| `testing/` | Frontend test launchers; `bun run test:unit`, `bun run test:browser`, `bun run test:browser-acquisition` |

Generic checks use `agent-tool run`; shared validation groups, including the
push gate's steps, use `agent-tool run-group`, and `agent-tool runs list` shows
their timings.

Application-specific scripts stay with their package. Backend administration is
in `packages/backend-v2/scripts/admin/` (`bun run manage` there); its schema and
configuration checks live in `packages/backend-v2/scripts/checks/`, with shared
migration fixtures in `packages/backend-v2/scripts/lib/`. Frontend single-spec
launchers live in `packages/frontend/scripts/testing/`
(`bun run test:spec` / `bun run test:spec:headless`). Terraform retains its
stack-aware `terraform/scripts/tf` entrypoint and infrastructure layout.

See [CI and merge requirements](../docs/ci-merge-gate.md) for gate semantics,
[dependency maintenance](../docs/dependencies.md) for upgrades, and each
application README for its test and deployment commands.
