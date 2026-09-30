import { describe, expect, test } from "bun:test";

import {
  bumpPatch,
  isReleaseBump,
  isVersionedManifest,
  readVersion,
  withVersion,
} from "./packageVersion";

const manifest = `{
  "name": "demo",
  "version": "0.7.101",
  "overrides": {
    "thing": { "version": "0.7.101" }
  }
}
`;

describe("packageVersion", () => {
  test("bumps only the patch", () => {
    expect(bumpPatch("0.7.101")).toBe("0.7.102");
    expect(bumpPatch("1.0.9")).toBe("1.0.10");
  });

  test("rejects versions that are not plain major.minor.patch", () => {
    expect(() => bumpPatch("1.0.0-beta.1")).toThrow("not a plain");
    expect(() => bumpPatch("01.0.0")).toThrow("not a plain");
  });

  test("treats a major or minor increase as a deliberate release", () => {
    expect(isReleaseBump("0.8.0", "0.7.101")).toBe(true);
    expect(isReleaseBump("1.0.0", "0.7.101")).toBe(true);
    expect(isReleaseBump("0.7.105", "0.7.101")).toBe(false);
    expect(isReleaseBump("0.7.101", "0.7.101")).toBe(false);
  });

  test("rewrites only the top-level version line", () => {
    const updated = withVersion(manifest, "0.7.102");
    expect(readVersion(updated)).toBe("0.7.102");
    expect(updated).toBe(
      manifest.replace('"version": "0.7.101"', '"version": "0.7.102"'),
    );
  });

  test("refuses to rewrite a nested version that comes first", () => {
    const nestedFirst = `{"overrides": {"version": "1.0.0"}, "version": "1.0.0"}`;
    expect(() => withVersion(nestedFirst, "1.0.1")).toThrow(
      "could not rewrite",
    );
  });

  test("names the frontend and backend-v2 manifests as versioned", () => {
    expect(isVersionedManifest("packages/frontend/package.json")).toBe(true);
    expect(isVersionedManifest("packages/backend-v2/package.json")).toBe(true);
    expect(isVersionedManifest("packages/agent-tool/package.json")).toBe(false);
  });
});
