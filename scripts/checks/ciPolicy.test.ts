import { describe, expect, test } from "bun:test";
import { assertCiSuccess, ciDiffRange, ciScopes } from "./ciPolicy";

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
      "packages/agent-tool/src/index.ts",
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
    expect(ciScopes(["scripts/runWebdriverTests.sh"]).frontend).toBe(true);
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

  test("workflow and lockfile changes run every lane", () => {
    for (const path of [
      ".github/workflows/frontend.yml",
      "bun.lock",
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
      "backend-v2 must be skipped",
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
    ).toThrow("api-shared must be success: skipped");
    expect(() =>
      assertCiSuccess({ ...needs, "backend-v2": { result: "skipped" } }),
    ).toThrow("backend-v2 must be success: skipped");
  });

  test("fails when change detection did not succeed", () => {
    expect(() =>
      assertCiSuccess({ changes: { result: "failure" }, ...jobs("skipped") }),
    ).toThrow("changes did not succeed");
  });

  test("fails a required lane that failed, was cancelled, or skipped", () => {
    for (const result of ["failure", "cancelled", "skipped"]) {
      expect(() =>
        assertCiSuccess({
          changes: scopes("true"),
          ...jobs("success"),
          frontend: { result },
        }),
      ).toThrow(`frontend must be success: ${result}`);
    }
  });

  test("fails an irrelevant lane that ran anyway or went missing", () => {
    expect(() =>
      assertCiSuccess({
        changes: scopes("false"),
        ...jobs("skipped"),
        frontend: { result: "success" },
      }),
    ).toThrow("frontend must be skipped");
    const { frontend: _frontend, ...withoutFrontend } = jobs("skipped");
    expect(() =>
      assertCiSuccess({ changes: scopes("false"), ...withoutFrontend }),
    ).toThrow("frontend must be skipped: missing");
  });

  test("fails on a missing or malformed scope output", () => {
    expect(() =>
      assertCiSuccess({ changes: scopes("maybe"), ...jobs("success") }),
    ).toThrow("Missing or invalid change scope");
  });
});
