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
    expect(ciScopes(["backend/tearleads/urls.py"])).toEqual({
      tooling: false,
      backend: true,
      frontend: false,
      backendV2: false,
    });
    expect(ciScopes(["backend-v2/src/app.ts"])).toEqual({
      tooling: false,
      backend: false,
      frontend: false,
      backendV2: true,
    });
    expect(ciScopes(["frontend/src/App.tsx"])).toEqual({
      tooling: false,
      backend: false,
      frontend: true,
      backendV2: false,
    });
    expect(ciScopes(["scripts/runWebdriverTests.sh"]).frontend).toBe(true);
    expect(ciScopes(["scripts/runBackendTests.sh"]).backend).toBe(true);
  });

  test("skips every lane for unrelated paths", () => {
    expect(ciScopes(["README.md", "terraform/dns/main.tf"])).toEqual({
      tooling: false,
      backend: false,
      frontend: false,
      backendV2: false,
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
      backend: value,
      frontend: value,
      backendV2: value,
    },
  });
  const jobs = (result: string) => ({
    tooling: { result },
    backend: { result },
    "backend-v2": { result },
    frontend: { result },
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
        backend: "false",
        frontend: "true",
        backendV2: "false",
      },
    };
    const needs = {
      changes,
      tooling: { result: "skipped" },
      backend: { result: "skipped" },
      "backend-v2": { result: "success" },
      frontend: { result: "success" },
    };
    expect(() => assertCiSuccess(needs)).toThrow(
      "backend-v2 must be skipped",
    );
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
          backend: { result },
        }),
      ).toThrow("backend must be success");
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
