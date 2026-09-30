import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { bumpVersions, checkVersions, planVersions } from "./bumpVersions";
import { resolveVersionConflicts } from "./resolveVersionConflicts";

const repositories: string[] = [];
let stdout: string[] = [];

function git(rootDir: string, args: string[]): string {
  return execFileSync(
    "git",
    [
      "-c",
      "commit.gpgsign=false",
      "-c",
      "core.hooksPath=/dev/null",
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.com",
      ...args,
    ],
    { cwd: rootDir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ).trim();
}

function manifest(name: string, version: string, extra = ""): string {
  return `{
  "name": "${name}",
  "version": "${version}",
  "private": true,${extra}
  "type": "module"
}
`;
}

function write(rootDir: string, file: string, source: string): void {
  const target = path.join(rootDir, file);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, source);
}

function read(rootDir: string, file: string): string {
  return readFileSync(path.join(rootDir, file), "utf8");
}

function commitAll(rootDir: string, message: string): string {
  git(rootDir, ["add", "-A"]);
  git(rootDir, ["commit", "-q", "-m", message]);
  return git(rootDir, ["rev-parse", "HEAD"]);
}

const FRONTEND = "packages/frontend/package.json";
const BACKEND = "packages/backend-v2/package.json";

/** A repo on `main` with both versioned packages, checked out on `feature`. */
function repository(): string {
  const rootDir = mkdtempSync(path.join(tmpdir(), "agent-tool-versions-"));
  repositories.push(rootDir);
  git(rootDir, ["init", "-q", "-b", "main"]);
  write(rootDir, FRONTEND, manifest("frontend", "0.7.101"));
  write(rootDir, "packages/frontend/src/app.ts", "export {};\n");
  write(rootDir, BACKEND, manifest("backend", "0.2.0"));
  write(rootDir, "packages/backend-v2/src/app.ts", "export {};\n");
  write(rootDir, "README.md", "demo\n");
  commitAll(rootDir, "chore: initial");
  git(rootDir, ["checkout", "-q", "-b", "feature"]);
  return rootDir;
}

/** Commit on `main` without leaving `feature`, returning the new main OID. */
function commitOnMain(rootDir: string, files: Record<string, string>): string {
  git(rootDir, ["checkout", "-q", "main"]);
  for (const [file, source] of Object.entries(files)) {
    write(rootDir, file, source);
  }
  const oid = commitAll(rootDir, "chore: main moves");
  git(rootDir, ["checkout", "-q", "feature"]);
  return oid;
}

function mainOid(rootDir: string): string {
  return git(rootDir, ["rev-parse", "main"]);
}

beforeEach(() => {
  stdout = [];
  spyOn(process.stdout, "write").mockImplementation((chunk) => {
    stdout.push(String(chunk));
    return true;
  });
  spyOn(process.stderr, "write").mockImplementation(() => true);
});

afterEach(() => {
  mock.restore();
  for (const rootDir of repositories.splice(0)) {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

describe("bumpVersions", () => {
  test("patch-bumps only the packages the branch changes", () => {
    const rootDir = repository();
    write(rootDir, "packages/frontend/src/app.ts", "export const a = 1;\n");
    commitAll(rootDir, "feat: change frontend");
    const base = mainOid(rootDir);

    expect(checkVersions(rootDir, base)).toBe(1);
    expect(bumpVersions(rootDir, base)).toBe(0);

    expect(stdout.join("")).toBe(`${FRONTEND}\n`);
    expect(read(rootDir, FRONTEND)).toBe(manifest("frontend", "0.7.102"));
    expect(read(rootDir, BACKEND)).toBe(manifest("backend", "0.2.0"));
    commitAll(rootDir, "chore: bump package versions");
    expect(checkVersions(rootDir, base)).toBe(0);
  });

  test("is a no-op once the branch carries the bump", () => {
    const rootDir = repository();
    write(rootDir, "packages/backend-v2/src/app.ts", "export const b = 1;\n");
    write(rootDir, BACKEND, manifest("backend", "0.2.1"));
    commitAll(rootDir, "feat: change backend");

    expect(bumpVersions(rootDir, mainOid(rootDir))).toBe(0);
    expect(stdout).toEqual([]);
  });

  test("re-bumps past a base that took the same version first", () => {
    const rootDir = repository();
    write(rootDir, "packages/frontend/src/app.ts", "export const a = 1;\n");
    write(rootDir, FRONTEND, manifest("frontend", "0.7.102"));
    commitAll(rootDir, "feat: change frontend");
    const base = commitOnMain(rootDir, {
      "packages/frontend/src/other.ts": "export {};\n",
      [FRONTEND]: manifest("frontend", "0.7.102"),
    });
    git(rootDir, ["merge", "-q", "--no-edit", base]);

    expect(planVersions(rootDir, base)).toContainEqual({
      manifest: FRONTEND,
      baseVersion: "0.7.102",
      headVersion: "0.7.102",
      targetVersion: "0.7.103",
    });
    bumpVersions(rootDir, base);
    expect(read(rootDir, FRONTEND)).toBe(manifest("frontend", "0.7.103"));
  });

  test("returns a version-only change to the base version", () => {
    const rootDir = repository();
    write(rootDir, FRONTEND, manifest("frontend", "0.7.102"));
    commitAll(rootDir, "chore: stale bump");

    bumpVersions(rootDir, mainOid(rootDir));
    expect(read(rootDir, FRONTEND)).toBe(manifest("frontend", "0.7.101"));
  });

  test("counts manifest edits beyond the version as a change", () => {
    const rootDir = repository();
    write(
      rootDir,
      FRONTEND,
      manifest("frontend", "0.7.101", '\n  "license": "MIT",'),
    );
    commitAll(rootDir, "chore: add license");

    bumpVersions(rootDir, mainOid(rootDir));
    expect(read(rootDir, FRONTEND)).toBe(
      manifest("frontend", "0.7.102", '\n  "license": "MIT",'),
    );
  });

  test("keeps a deliberate minor release", () => {
    const rootDir = repository();
    write(rootDir, "packages/frontend/src/app.ts", "export const a = 1;\n");
    write(rootDir, FRONTEND, manifest("frontend", "0.8.0"));
    commitAll(rootDir, "feat: release frontend 0.8");

    expect(checkVersions(rootDir, mainOid(rootDir))).toBe(0);
  });

  test("refuses to overwrite uncommitted manifest edits", () => {
    const rootDir = repository();
    write(rootDir, "packages/frontend/src/app.ts", "export const a = 1;\n");
    commitAll(rootDir, "feat: change frontend");
    write(rootDir, FRONTEND, manifest("frontend", "0.7.101", '\n  "x": 1,'));

    expect(() => bumpVersions(rootDir, mainOid(rootDir))).toThrow(
      "uncommitted changes",
    );
  });

  test("requires a full base OID", () => {
    const rootDir = repository();
    expect(() => bumpVersions(rootDir, "main")).toThrow("full Git OID");
  });
});

describe("resolveVersionConflicts", () => {
  /** The branch bumped once; main then moved two versions and a dependency. */
  function conflictedMerge(
    extraMainFiles: Record<string, string> = {},
  ): string {
    const rootDir = repository();
    write(rootDir, "packages/frontend/src/app.ts", "export const a = 1;\n");
    write(rootDir, FRONTEND, manifest("frontend", "0.7.102"));
    commitAll(rootDir, "feat: change frontend");
    commitOnMain(rootDir, {
      [FRONTEND]: manifest("frontend", "0.7.103", '\n  "license": "MIT",'),
      ...extraMainFiles,
    });
    const merge = spawnSync("git", ["merge", "--no-edit", "main"], {
      cwd: rootDir,
      stdio: "ignore",
    });
    expect(merge.status).not.toBe(0);
    return rootDir;
  }

  test("takes the base version and keeps both sides' other edits", () => {
    const rootDir = conflictedMerge();

    expect(resolveVersionConflicts(rootDir)).toBe(0);
    expect(read(rootDir, FRONTEND)).toBe(
      manifest("frontend", "0.7.103", '\n  "license": "MIT",'),
    );
    expect(git(rootDir, ["diff", "--name-only", "--diff-filter=U"])).toBe("");
    git(rootDir, ["commit", "-q", "--no-edit"]);

    bumpVersions(rootDir, mainOid(rootDir));
    expect(read(rootDir, FRONTEND)).toBe(
      manifest("frontend", "0.7.104", '\n  "license": "MIT",'),
    );
  });

  test("keeps the branch's deliberate minor release", () => {
    const rootDir = repository();
    write(rootDir, "packages/frontend/src/app.ts", "export const a = 1;\n");
    write(rootDir, FRONTEND, manifest("frontend", "0.8.0"));
    commitAll(rootDir, "feat: release frontend 0.8");
    commitOnMain(rootDir, {
      [FRONTEND]: manifest("frontend", "0.7.103", '\n  "license": "MIT",'),
    });
    const merge = spawnSync("git", ["merge", "--no-edit", "main"], {
      cwd: rootDir,
      stdio: "ignore",
    });
    expect(merge.status).not.toBe(0);

    expect(resolveVersionConflicts(rootDir)).toBe(0);
    expect(read(rootDir, FRONTEND)).toBe(
      manifest("frontend", "0.8.0", '\n  "license": "MIT",'),
    );
    git(rootDir, ["commit", "-q", "--no-edit"]);
    expect(checkVersions(rootDir, mainOid(rootDir))).toBe(0);
  });

  test("touches nothing when another file conflicts", () => {
    const rootDir = repository();
    write(rootDir, "README.md", "branch\n");
    write(rootDir, FRONTEND, manifest("frontend", "0.7.102"));
    commitAll(rootDir, "feat: change readme");
    commitOnMain(rootDir, {
      "README.md": "main\n",
      [FRONTEND]: manifest("frontend", "0.7.103"),
    });
    spawnSync("git", ["merge", "--no-edit", "main"], {
      cwd: rootDir,
      stdio: "ignore",
    });
    const before = read(rootDir, FRONTEND);

    expect(resolveVersionConflicts(rootDir)).toBe(1);
    expect(read(rootDir, FRONTEND)).toBe(before);
    expect(git(rootDir, ["diff", "--name-only", "--diff-filter=U"])).toContain(
      FRONTEND,
    );
  });

  test("refuses a manifest that conflicts beyond its version", () => {
    const rootDir = repository();
    write(
      rootDir,
      FRONTEND,
      manifest("frontend", "0.7.102", '\n  "license": "ISC",'),
    );
    commitAll(rootDir, "chore: license");
    commitOnMain(rootDir, {
      [FRONTEND]: manifest("frontend", "0.7.103", '\n  "license": "MIT",'),
    });
    spawnSync("git", ["merge", "--no-edit", "main"], {
      cwd: rootDir,
      stdio: "ignore",
    });

    expect(resolveVersionConflicts(rootDir)).toBe(1);
  });

  test("requires a merge in progress", () => {
    expect(resolveVersionConflicts(repository())).toBe(1);
  });
});
