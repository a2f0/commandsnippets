import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { ciDiffRange, ciScopes, CI_SCOPES } from "./ciPolicy";
import gatePolicy from "./ciGate.json";

const root = path.resolve(import.meta.dirname, "../..");
function assertCiSuccess(needs: unknown): void {
  const result = spawnSync(path.join(root, "node_modules/.bin/agent-tool"),
    ["ci", "gate", "-", "--policy", "scripts/checks/ciGate.json"],
    { cwd: root, input: JSON.stringify(needs), encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stdout + result.stderr);
}

test("gate policy covers every classified scope", () => {
  expect(gatePolicy.conditional.map(rule => rule.output).sort()).toEqual(Object.keys(CI_SCOPES).sort());
  expect(gatePolicy.conditional.every(rule => rule.source === "changes")).toBe(true);
});

const sha = (c: string) => c.repeat(40);

describe("ciDiffRange", () => {
  test("uses a three-dot range between full SHAs", () => {
    expect(ciDiffRange(sha("a"), sha("b"))).toBe(`${sha("a")}...${sha("b")}`);
  });

  test("has no range for a new branch or missing base", () => {
    expect(ciDiffRange(undefined, sha("b"))).toBeUndefined();
    expect(ciDiffRange(sha("0"), sha("b"))).toBeUndefined();
  });

  test("rejects abbreviated or missing SHAs", () => {
    expect(() => ciDiffRange("abc123", sha("b"))).toThrow("full base and head");
    expect(() => ciDiffRange(sha("a"), undefined)).toThrow("full base and head");
  });
});

describe("ciScopes", () => {
  test("selects tooling for packages, scripts, and tooling config", () => {
    for (const path of [
      "agent-tool.json",
      ".agent-tool-skills.json",
      ".agents/skills/ship-pr/SKILL.md",
      ".claude/skills/ship-pr/SKILL.md",
      "scripts/git/hooks/pre-push",
      "commitlint.config.mts",
      "tsconfig.base.json",
    ]) {
      expect(ciScopes([path]).tooling).toBe(true);
    }
  });

  test("selects application lanes by their paths", () => {
    expect(ciScopes(["packages/backend-v2/src/app.ts"])).toEqual({
      tooling: false,
      frontend: false,
      backendV2: true,
      apiShared: false,
      website: false,
      terraform: false,
    });
    expect(ciScopes(["packages/frontend/src/App.tsx"])).toEqual({
      tooling: false,
      frontend: true,
      backendV2: false,
      apiShared: false,
      website: false,
      terraform: false,
    });
    expect(ciScopes(["packages/api-shared/src/index.ts"])).toEqual({
      tooling: false,
      frontend: true,
      backendV2: true,
      apiShared: true,
      website: false,
      terraform: false,
    });
    expect(ciScopes(["scripts/testing/runWebdriverTests.sh"]).frontend).toBe(true);
    // The spec launchers are linted and tested by the tooling lane.
    expect(ciScopes(["packages/frontend/scripts/testing/runSpec.sh"])).toMatchObject({
      tooling: true,
      frontend: true,
    });
    expect(ciScopes(["terraform/stacks/zone/main.tf"])).toEqual({
      tooling: false,
      frontend: false,
      backendV2: false,
      apiShared: false,
      website: false,
      terraform: true,
    });
    expect(ciScopes(["packages/website/src/pages/index.astro"])).toEqual({
      tooling: false,
      frontend: false,
      backendV2: false,
      apiShared: false,
      website: true,
      terraform: false,
    });
  });

  test("brand sources and image settings run the web package lanes", () => {
    expect(ciScopes(["assets/brand/logo.svg"])).toEqual({
      tooling: false,
      frontend: true,
      backendV2: false,
      apiShared: false,
      website: true,
      terraform: false,
    });
    expect(ciScopes(["agent-tool.json"])).toEqual({
      tooling: true,
      frontend: true,
      backendV2: false,
      apiShared: false,
      website: true,
      terraform: false,
    });
  });

  test("skips every lane for unrelated paths", () => {
    expect(ciScopes(["README.md", "docs/ci-merge-gate.md"])).toEqual({
      tooling: false,
      frontend: false,
      backendV2: false,
      apiShared: false,
      website: false,
      terraform: false,
    });
  });

  test("workflow, toolchain and lockfile changes run every lane", () => {
    for (const path of [
      ".github/workflows/frontend.yml",
      "bun.lock",
      ".mise.toml",
      "package.json",
      "scripts/checks/ciPolicy.ts",
    ]) {
      expect(Object.values(ciScopes([path])).every(Boolean)).toBe(true);
    }
  });
});

describe("assertCiSuccess", () => {
  const scopes = (value: string) => ({
    result: "success",
    outputs: {
      tooling: value,
      frontend: value,
      backendV2: value,
      apiShared: value,
      website: value,
      terraform: value,
    },
  });
  const jobs = (result: string) => ({
    tooling: { result },
    "backend-v2": { result },
    "api-shared": { result },
    frontend: { result },
    website: { result },
    terraform: { result },
  });

  test("passes when required lanes succeeded or irrelevant ones skipped", () => {
    expect(() =>
      assertCiSuccess({ changes: scopes("true"), ...jobs("success") }),
    ).not.toThrow();
    expect(() =>
      assertCiSuccess({ changes: scopes("false"), ...jobs("skipped") }),
    ).not.toThrow();
  });

  test("each lane follows its own scope", () => {
    const changes = {
      result: "success",
      outputs: {
        tooling: "false",
        frontend: "true",
        backendV2: "false",
        apiShared: "false",
        website: "false",
        terraform: "false",
      },
    };
    const needs = {
      changes,
      tooling: { result: "skipped" },
      "backend-v2": { result: "success" },
      "api-shared": { result: "skipped" },
      frontend: { result: "success" },
      website: { result: "skipped" },
      terraform: { result: "skipped" },
    };
    expect(() => assertCiSuccess(needs)).toThrow(
      "backend-v2: expected skipped",
    );
  });

  test("api-shared changes require its lane and its consumers' lanes", () => {
    const changes = {
      result: "success",
      outputs: {
        tooling: "false",
        frontend: "true",
        backendV2: "true",
        apiShared: "true",
        website: "false",
        terraform: "false",
      },
    };
    const needs = {
      changes,
      ...jobs("skipped"),
      "backend-v2": { result: "success" },
      "api-shared": { result: "success" },
      frontend: { result: "success" },
    };
    expect(() => assertCiSuccess(needs)).not.toThrow();
    expect(() =>
      assertCiSuccess({ ...needs, "api-shared": { result: "skipped" } }),
    ).toThrow("api-shared: expected success");
    expect(() =>
      assertCiSuccess({ ...needs, "backend-v2": { result: "skipped" } }),
    ).toThrow("backend-v2: expected success");
  });

  test("fails when change detection did not succeed", () => {
    expect(() =>
      assertCiSuccess({ changes: { result: "failure" }, ...jobs("skipped") }),
    ).toThrow("changes: expected success");
  });

  test("fails a required lane that failed, was cancelled, or skipped", () => {
    for (const result of ["failure", "cancelled", "skipped"]) {
      expect(() =>
        assertCiSuccess({
          changes: scopes("true"),
          ...jobs("success"),
          frontend: { result },
        }),
      ).toThrow(`frontend: expected success`);
    }
  });

  test("fails an irrelevant lane that ran anyway or went missing", () => {
    expect(() =>
      assertCiSuccess({
        changes: scopes("false"),
        ...jobs("skipped"),
        frontend: { result: "success" },
      }),
    ).toThrow("frontend: expected skipped");
    const { frontend: _frontend, ...withoutFrontend } = jobs("skipped");
    expect(() =>
      assertCiSuccess({ changes: scopes("false"), ...withoutFrontend }),
    ).toThrow("frontend: expected skipped");
  });

  test("fails on a missing or malformed scope output", () => {
    expect(() =>
      assertCiSuccess({ changes: scopes("maybe"), ...jobs("success") }),
    ).toThrow("must succeed and produce 'true' or 'false'");
  });
});
