# Repository scripts

Use package scripts as the normal entrypoints. Shared branch, commit, hook,
review, and PR mechanics come from the exact-pinned `@a2f0/agent-tool`;
`agent-tool.json` holds this repository's policy.

| Group | Purpose and entrypoints |
| --- | --- |
| `checks/` | CI path classification, PR-title commitlint, and policy tests; `bun run test:scripts` |
| `git/hooks/` | Commit-message and conditional pre-push hooks; `bun run hooks:install` / `bun run hooks:check` |
| `git/` | Push-specific timing history; `bun run timings:push -- --head <sha>` |
| `lib/` | Timing helpers shared by the push gate and its history viewer |
| `testing/` | Frontend test launchers; `bun run test:unit` / `bun run test:browser` |

The push timing helpers remain local because they record the actual remote,
every pushed ref, failed/unfinished steps, and the last 20 runs. Generic checks
use `agent-tool run`; shared validation groups use `agent-tool run-group`.

Application-specific scripts stay with their package. Backend administration is
in `packages/backend-v2/scripts/admin/` (`bun run manage` there); its schema and
configuration checks live in `scripts/checks/`, with shared migration fixtures
in `scripts/lib/`. Frontend single-spec launchers live in its `scripts/testing/`
(`bun run test:spec` / `bun run test:spec:headless`). Terraform retains its
stack-aware `terraform/scripts/tf` entrypoint and infrastructure layout.

See [CI and merge requirements](../docs/ci-merge-gate.md) for gate semantics,
[dependency maintenance](../docs/dependencies.md) for upgrades, and each
application README for its test and deployment commands.
