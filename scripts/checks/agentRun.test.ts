import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync, rmdirSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");

test.each([0, 23])("agent:run preserves argv and exit %i", (exitCode) => {
  const args = ["two words", "--child-option", "$(literal)", "quote'\"", ""];
  const result = spawnSync(
    process.execPath,
    [
      "run",
      "agent:run",
      "--label",
      "entrypoint-test",
      "--",
      process.execPath,
      "-e",
      `console.log(JSON.stringify({
        args: process.argv.slice(1),
        cwd: process.cwd(),
        marker: process.env.AGENT_RUN_TEST_MARKER,
      }));
      console.error("child stderr marker");
      process.exit(${exitCode});`,
      "--",
      ...args,
    ],
    {
      cwd: root,
      env: { ...process.env, AGENT_RUN_TEST_MARKER: "inherited environment" },
      encoding: "utf8",
      timeout: 10_000,
    },
  );
  const receipt = JSON.parse(result.stdout) as {
    log: string;
    exitCode: number;
    status: string;
  };
  try {
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(exitCode);
    expect(receipt.exitCode).toBe(exitCode);
    expect(receipt.status).toBe(exitCode === 0 ? "passed" : "failed");
    const log = readFileSync(receipt.log, "utf8");
    const payload = log.split("\n").find((line) => line.startsWith("{"));
    expect(JSON.parse(payload ?? "null")).toEqual({
      args,
      cwd: root,
      marker: "inherited environment",
    });
    expect(log).toContain("child stderr marker");
    expect(result.stdout).not.toContain("child stderr marker");
    if (exitCode !== 0) expect(result.stderr).toContain("child stderr marker");
  } finally {
    unlinkSync(receipt.log);
    rmdirSync(dirname(receipt.log));
  }
});
