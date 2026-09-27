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

  test("skips tooling for unrelated paths", () => {
    expect(ciScopes(["frontend/src/App.tsx", "README.md"]).tooling).toBe(false);
  });

  test("workflow and lockfile changes run every lane", () => {
    for (const path of [".github/workflows/frontend.yml", "bun.lock", "package.json"]) {
      expect(ciScopes([path]).tooling).toBe(true);
    }
  });
});

describe("assertCiSuccess", () => {
  const changes = (tooling: string) => ({
    result: "success",
    outputs: { tooling },
  });

  test("passes when a required lane succeeded or an irrelevant one skipped", () => {
    expect(() =>
      assertCiSuccess({ changes: changes("true"), tooling: { result: "success" } }),
    ).not.toThrow();
    expect(() =>
      assertCiSuccess({ changes: changes("false"), tooling: { result: "skipped" } }),
    ).not.toThrow();
  });

  test("fails when change detection did not succeed", () => {
    expect(() =>
      assertCiSuccess({ changes: { result: "failure" }, tooling: { result: "skipped" } }),
    ).toThrow("changes did not succeed");
  });

  test("fails a required lane that failed, was cancelled, or skipped", () => {
    for (const result of ["failure", "cancelled", "skipped"]) {
      expect(() =>
        assertCiSuccess({ changes: changes("true"), tooling: { result } }),
      ).toThrow("tooling must be success");
    }
  });

  test("fails an irrelevant lane that ran anyway or went missing", () => {
    expect(() =>
      assertCiSuccess({ changes: changes("false"), tooling: { result: "success" } }),
    ).toThrow("tooling must be skipped");
    expect(() => assertCiSuccess({ changes: changes("false") })).toThrow(
      "tooling must be skipped: missing",
    );
  });

  test("fails on a missing or malformed scope output", () => {
    expect(() =>
      assertCiSuccess({ changes: changes("maybe"), tooling: { result: "success" } }),
    ).toThrow("Missing or invalid change scope");
  });
});
