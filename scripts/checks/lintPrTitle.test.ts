import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
test.each([
  ["chore: normalize repository tooling", true],
  ["cleanup: remove obsolete helpers", true],
  ["fix: Start uppercase", false],
  ["fix: end with a period.", false],
  [`fix: ${"a".repeat(46)}`, false],
  ["not conventional", false],
  ["fix: first line\nsecond line", false],
])("PR title %s preserves commitlint policy", (title, valid) => {
  const result = spawnSync(process.execPath, ["scripts/checks/lintPrTitle.ts"], {
    cwd: root, env: { ...process.env, PR_TITLE: title }, encoding: "utf8",
  });
  expect(result.status === 0).toBe(valid);
});
