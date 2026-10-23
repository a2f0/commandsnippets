import { afterEach, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "../..");
const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

test.each([
  ["scripts/testing/runUnitTests.sh", ["x", "vitest", "--no-watch"]],
  ["scripts/testing/runWebdriverTests.sh", ["run", "ci-headless"]],
  ["packages/frontend/scripts/testing/runSpec.sh", ["x", "start-server-and-test"]],
  ["packages/frontend/scripts/testing/runSpecHeadless.sh", ["x", "start-server-and-test"]],
])("%s finds the frontend from an unrelated directory", (script, prefix) => {
  const directory = mkdtempSync(path.join(tmpdir(), "commandsnippets-entrypoint-"));
  directories.push(directory);
  const binary = path.join(directory, "bun");
  writeFileSync(binary, `#!/bin/sh\nexec '${process.execPath}' -e 'console.log(JSON.stringify({cwd:process.cwd(),args:process.argv.slice(1),options:process.env.NODE_OPTIONS,spec:process.env.SPEC_FILE}))' -- "$@"\n`);
  chmodSync(binary, 0o755);
  const spec = "test/specs/two words.spec.ts";
  const result = spawnSync("sh", [path.join(root, script), spec], {
    cwd: directory,
    env: { ...process.env, PATH: `${directory}:${process.env["PATH"]}`, NODE_OPTIONS: "--enable-source-maps" },
    encoding: "utf8",
  });
  expect(result.status).toBe(0);
  const output = JSON.parse(result.stdout);
  expect(output.cwd).toBe(path.join(root, "packages/frontend"));
  expect(output.args.slice(0, prefix.length)).toEqual(prefix);
  if (script.includes("runSpec")) {
    expect(output.spec).toBe(spec);
    expect(output.args.at(-1)).toContain('--spec "$SPEC_FILE"');
  } else {
    expect(output.args.at(-1)).toBe(spec);
  }
  if (script.includes("runUnit")) {
    expect(output.options).toBe("--enable-source-maps --no-experimental-webstorage");
  }
});
