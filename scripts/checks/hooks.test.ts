import { afterEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import {
  appendFileSync,
  chmodSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const TOOL = path.join(REPO_ROOT, "node_modules/.bin/agent-tool");

// Each test signs commits in fresh repositories and runs the real hook, which
// takes a few seconds and longer on a busy machine than bun's 5s default.
setDefaultTimeout(30_000);

const temporary: string[] = [];
function tempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "hooks-test-"));
  temporary.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of temporary.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * The environment without Git's repository variables. A hook run exports them
 * (pre-push from a linked worktree sets GIT_DIR), and they would point every
 * test repository's git commands at the repository being pushed.
 */
const testEnv = Object.fromEntries(
  Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")),
);

function run(command: string[], cwd: string) {
  const result = Bun.spawnSync(command, {
    cwd,
    env: {
      ...testEnv,
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_NOSYSTEM: "1",
    },
  });
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

/** A scratch repo whose commits are SSH-signed with a throwaway key. */
function signedRepo(): string {
  const dir = tempDir();
  const key = path.join(dir, "signing-key");
  expect(
    run(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-f", key], dir)
      .exitCode,
  ).toBe(0);
  // Without an allowed-signers file git reports SSH signatures as "N"
  // (unsigned), which the configured signature-presence check rejects.
  const allowedSigners = path.join(dir, "allowed-signers");
  writeFileSync(
    allowedSigners,
    `test@example.com ${readFileSync(`${key}.pub`, "utf8")}`,
  );
  const repo = path.join(dir, "repo");
  for (const command of [
    ["git", "init", "-q", "-b", "main", repo],
    ["git", "-C", repo, "config", "user.name", "Test"],
    ["git", "-C", repo, "config", "user.email", "test@example.com"],
    ["git", "-C", repo, "config", "gpg.format", "ssh"],
    ["git", "-C", repo, "config", "user.signingkey", key],
    ["git", "-C", repo, "config", "commit.gpgsign", "true"],
    ["git", "-C", repo, "config", "gpg.ssh.allowedSignersFile", allowedSigners],
  ]) {
    expect(run(command, dir).exitCode).toBe(0);
  }
  commit(repo, "chore: base");
  return repo;
}

function commit(repo: string, message: string, sign = true): void {
  const result = run(
    [
      "git",
      "commit",
      "-q",
      "--allow-empty",
      ...(sign ? [] : ["--no-gpg-sign"]),
      "-m",
      message,
    ],
    repo,
  );
  expect(result.exitCode).toBe(0);
}

describe("pre-push", () => {
  const ZERO = "0".repeat(40);

  function git(repo: string, ...args: string[]): string {
    const result = run(["git", ...args], repo);
    expect(result.exitCode).toBe(0);
    return result.stdout.trim();
  }

  // Commits skip the installed commit-msg hook, which needs commitlint.
  function commitAll(repo: string, message: string): void {
    git(repo, "add", "-A");
    git(repo, "commit", "-q", "--no-verify", "--allow-empty", "-m", message);
  }

  /**
   * A signed repo carrying the real hook and its helpers, with package
   * scripts stubbed so a run shows which checks it triggered. `setup` adds
   * to `main` before the feature branch starts.
   */
  function hookRepo(setup?: (repo: string) => void): string {
    const repo = signedRepo();
    for (const dir of ["scripts/git", "scripts/lib"]) {
      cpSync(path.join(REPO_ROOT, dir), path.join(repo, dir), {
        recursive: true,
      });
    }
    cpSync(path.join(REPO_ROOT, "agent-tool.json"), path.join(repo, "agent-tool.json"));
    cpSync(path.join(REPO_ROOT, "commitlint.config.mts"), path.join(repo, "commitlint.config.mts"));
    writeFileSync(path.join(repo, ".gitignore"), "node_modules/\n");
    symlinkSync(path.join(REPO_ROOT, "node_modules"), path.join(repo, "node_modules"), "dir");
    writeFileSync(
      path.join(repo, "package.json"),
      JSON.stringify({
        scripts: {
          "lint:branch-name": "true",
          "lint:shell": "echo LANE:tooling",
          typecheck: "true",
          "test:agent-tool": "true",
          "test:scripts": "true",
        },
      }),
    );
    writeFileSync(path.join(repo, "scripts/notes.txt"), "notes\n");
    commitAll(repo, "chore: add tooling");
    setup?.(repo);
    expect(run([TOOL, "hooks", "install", "--apply"], repo).exitCode).toBe(0);
    git(repo, "switch", "-q", "-c", "feat/x");
    return repo;
  }

  function prePush(
    repo: string,
    sha = git(repo, "rev-parse", "HEAD"),
    env: Record<string, string> = {},
    destination = "refs/heads/feat/x",
    remoteSha = ZERO,
  ) {
    const result = Bun.spawnSync([".git/hooks/pre-push", "origin", "url"], {
      cwd: repo,
      stdin: Buffer.from(`refs/heads/feat/x ${sha} ${destination} ${remoteSha}\n`),
      env: {
        ...testEnv,
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_CONFIG_NOSYSTEM: "1",
        PUSH_GATE_TIMINGS_LOG: path.join(tempDir(), "timings.tsv"),
        ...env,
      },
    });
    return {
      exitCode: result.exitCode,
      stdout: result.stdout.toString(),
      stderr: result.stderr.toString(),
    };
  }

  test("moving a file out of a checked area still runs its checks", () => {
    const repo = hookRepo();
    git(repo, "mv", "scripts/notes.txt", "notes.txt");
    commitAll(repo, "chore: move notes");
    const result = prePush(repo);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("LANE:tooling");
  });

  test("the frontend's spec launchers run the tooling checks", () => {
    const repo = hookRepo();
    mkdirSync(path.join(repo, "packages/frontend/scripts/testing"), { recursive: true });
    writeFileSync(path.join(repo, "packages/frontend/scripts/testing/runSpec.sh"), "#!/bin/sh\n");
    commitAll(repo, "test: add a spec launcher");
    const result = prePush(repo);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("LANE:tooling");
  });

  test("skips area checks for pushes outside every checked area", () => {
    const repo = hookRepo();
    writeFileSync(path.join(repo, "README.md"), "readme\n");
    commitAll(repo, "docs: add readme");
    const result = prePush(repo);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain("LANE:tooling");
  });

  test("refuses to vouch for uncommitted tracked changes", () => {
    const repo = hookRepo();
    appendFileSync(path.join(repo, "scripts/notes.txt"), "more\n");
    commitAll(repo, "chore: edit notes");
    appendFileSync(path.join(repo, "scripts/notes.txt"), "unpushed\n");
    const result = prePush(repo);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("uncommitted changes");
  });

  test("refuses to vouch for untracked files under a checked area", () => {
    const repo = hookRepo();
    appendFileSync(path.join(repo, "scripts/notes.txt"), "more\n");
    commitAll(repo, "chore: edit notes");
    writeFileSync(path.join(repo, "scripts/stray.test.ts"), "");
    const result = prePush(repo);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("untracked files");
  });

  test("refuses to vouch for a pushed commit other than HEAD", () => {
    const repo = hookRepo();
    appendFileSync(path.join(repo, "scripts/notes.txt"), "more\n");
    commitAll(repo, "chore: edit notes");
    const pushed = git(repo, "rev-parse", "HEAD");
    commitAll(repo, "chore: later work");
    const result = prePush(repo, pushed);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("validates the checked-out commit");
  });

  test("rejects a pushed commit with a co-author trailer", () => {
    const repo = hookRepo();
    writeFileSync(path.join(repo, "README.md"), "readme\n");
    commitAll(
      repo,
      "docs: add readme\n\nCo-authored-by: Claude <noreply@anthropic.com>",
    );
    const result = prePush(repo);
    expect(result.exitCode).toBe(1);
    expect(result.stdout + result.stderr).toContain("Co-authored-by");
  });

  test("validates the destination instead of only the current branch", () => {
    const repo = hookRepo();
    const result = prePush(repo, undefined, {}, "refs/heads/untyped");
    expect(result.exitCode).toBe(1);
    expect(result.stdout + result.stderr).toContain("untyped");
  });

  test("rejects a newly introduced unsigned commit", () => {
    const repo = hookRepo();
    commit(repo, "feat: unsigned work", false);
    const result = prePush(repo);
    expect(result.exitCode).toBe(1);
    expect(result.stdout + result.stderr).toContain("Signature does not meet");
  });

  test("base integration excludes history the push remote already owns", () => {
    const repo = hookRepo();
    git(repo, "remote", "add", "origin", repo);
    commit(repo, "feat: original work");
    const published = git(repo, "rev-parse", "HEAD");
    git(repo, "update-ref", "refs/remotes/origin/feat/x", published);
    git(repo, "switch", "main");
    // Simulate existing upstream history, not a new commit being introduced.
    git(repo, "-c", "core.hooksPath=/dev/null", "commit", "--no-gpg-sign",
      "--allow-empty", "-m", "chore: upstream work\n\nCo-authored-by: Ada <ada@example.com>");
    git(repo, "update-ref", "refs/remotes/origin/main", git(repo, "rev-parse", "HEAD"));
    git(repo, "switch", "feat/x");
    git(repo, "merge", "--no-ff", "origin/main", "-m", "chore: integrate main");
    const result = prePush(repo, undefined, {}, undefined, published);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('"checked": 1');
    commit(repo, "feat: new unsigned work", false);
    expect(prePush(repo, undefined, {}, undefined, published).exitCode).toBe(1);
  });

  test("commit-msg rejects attribution without rewriting the message", () => {
    const repo = hookRepo();
    const message = "fix: change\n\nCo-authored-by: Ada <ada@example.com>\n";
    const file = path.join(repo, ".git/TEST_COMMIT_EDITMSG");
    writeFileSync(file, message);
    const result = run([".git/hooks/commit-msg", file], repo);
    expect(result.exitCode).toBe(1);
    expect(readFileSync(file, "utf8")).toBe(message);
  });

  /**
   * A `terraform` stub on PATH that reports its arguments and exits with
   * `exitCode`, plus a terraform/ tree whose `bun test` passes or fails.
   */
  function terraformArea(repo: string, fmtExit: number, testPasses: boolean) {
    const bin = tempDir();
    writeFileSync(
      path.join(bin, "terraform"),
      `#!/bin/sh\necho "LANE:terraform $*"\nexit ${fmtExit}\n`,
    );
    chmodSync(path.join(bin, "terraform"), 0o755);
    mkdirSync(path.join(repo, "terraform/scripts"), { recursive: true });
    writeFileSync(path.join(repo, "terraform/main.tf"), "locals {}\n");
    writeFileSync(
      path.join(repo, "terraform/scripts/tf.test.ts"),
      `import {expect, test} from "bun:test";\n` +
        `test("wrapper", () => {\n` +
        `  console.log("LANE:terraform-wrapper");\n` +
        `  expect(${testPasses}).toBe(true);\n` +
        `});\n`,
    );
    commitAll(repo, "chore: add terraform");
    return { PATH: `${bin}:${process.env["PATH"]}` };
  }

  test("terraform-only changes run the terraform checks, not tooling", () => {
    const repo = hookRepo();
    const env = terraformArea(repo, 0, true);
    const result = prePush(repo, undefined, env);
    const output = result.stdout + result.stderr;
    expect(result.exitCode).toBe(0);
    expect(output).toContain("LANE:terraform fmt -check -recursive terraform");
    expect(output).toContain("LANE:terraform-wrapper");
    expect(output).not.toContain("LANE:tooling");
  });

  test("a terraform formatting failure blocks the push", () => {
    const repo = hookRepo();
    const env = terraformArea(repo, 3, true);
    const result = prePush(repo, undefined, env);
    expect(result.exitCode).not.toBe(0);
    expect(result.stdout + result.stderr).not.toContain("All checks passed.");
  });

  test("a failing wrapper test blocks the push", () => {
    const repo = hookRepo();
    const env = terraformArea(repo, 0, false);
    const result = prePush(repo, undefined, env);
    const output = result.stdout + result.stderr;
    expect(result.exitCode).not.toBe(0);
    expect(output).toContain("LANE:terraform-wrapper");
    expect(output).not.toContain("All checks passed.");
  });

  /**
   * Stub api-shared and backend-v2 packages (on main) whose scripts report
   * which checks ran; `failing` is an api-shared script that fails.
   */
  function packageAreas(failing?: string) {
    return (repo: string) => {
      const stub = (lane: string, names: string[]) =>
        Object.fromEntries(
          names.map((name) => [
            name,
            `echo LANE:${lane}:${name}${name === failing ? " && exit 1" : ""}`,
          ]),
        );
      writeFileSync(path.join(repo, ".gitignore"), "node_modules/\n");
      for (const [dir, scripts] of [
        ["api-shared", stub("api-shared", ["lint", "typecheck", "test"])],
        [
          "backend-v2",
          stub("backend-v2", [
            "lint",
            "typecheck",
            "test:coverage",
            "test:scripts",
          ]),
        ],
      ] as const) {
        mkdirSync(path.join(repo, "packages", dir, "src"), { recursive: true });
        writeFileSync(
          path.join(repo, "packages", dir, "package.json"),
          JSON.stringify({ name: dir, scripts }),
        );
        writeFileSync(path.join(repo, "packages", dir, "src/index.ts"), "");
      }
      commitAll(repo, "chore: add packages");
    };
  }

  function editPackage(repo: string, dir: string): void {
    appendFileSync(path.join(repo, "packages", dir, "src/index.ts"), "//\n");
    commitAll(repo, `feat: edit ${dir}`);
  }

  /** The api-shared and backend-v2 checks, in the order the hook runs them. */
  const PACKAGE_CHECKS = [
    "[api-shared-install]",
    "LANE:api-shared:lint",
    "LANE:api-shared:typecheck",
    "LANE:api-shared:test",
    "LANE:backend-v2:lint",
    "LANE:backend-v2:typecheck",
    "LANE:backend-v2:test:coverage",
    "LANE:backend-v2:test:scripts",
  ];

  function expectInOrder(output: string, lanes: readonly string[]): void {
    let previous = -1;
    for (const lane of lanes) {
      const index = output.indexOf(lane);
      expect(index).toBeGreaterThan(previous);
      previous = index;
    }
  }

  test("api-shared changes install the workspace, then check it and backend-v2", () => {
    const repo = hookRepo(packageAreas());
    editPackage(repo, "api-shared");
    const result = prePush(repo);
    const output = result.stdout + result.stderr;
    expect(result.exitCode).toBe(0);
    expectInOrder(output, PACKAGE_CHECKS);
    expect(output).not.toContain("[backend-v2-install]");
    expect(output).not.toContain("LANE:tooling");
  });

  test("backend-v2 changes alone neither check api-shared nor install", () => {
    const repo = hookRepo(packageAreas());
    editPackage(repo, "backend-v2");
    const result = prePush(repo);
    const output = result.stdout + result.stderr;
    expect(result.exitCode).toBe(0);
    expect(output).toContain("LANE:backend-v2:lint");
    expect(output).not.toContain("api-shared");
    expect(output).not.toContain("-install]");
  });

  test("workspace install changes check the tooling and every package", () => {
    const repo = hookRepo(packageAreas());
    writeFileSync(path.join(repo, "bunfig.toml"), "# install settings\n");
    commitAll(repo, "build: add install settings");
    const result = prePush(repo);
    const output = result.stdout + result.stderr;
    expect(result.exitCode).toBe(0);
    expectInOrder(output, ["LANE:tooling", ...PACKAGE_CHECKS]);
  });

  test("a failing api-shared check blocks the push", () => {
    const repo = hookRepo(packageAreas("typecheck"));
    editPackage(repo, "api-shared");
    const result = prePush(repo);
    const output = result.stdout + result.stderr;
    expect(result.exitCode).not.toBe(0);
    expect(output).toContain("LANE:api-shared:typecheck");
    expect(output).not.toContain("LANE:api-shared:test");
    expect(output).not.toContain("All checks passed.");
  });

  test("brand source changes check the website, which renders its icons", () => {
    const repo = hookRepo((repo) => {
      const scripts = Object.fromEntries(
        ["lint", "check", "test"].map((name) => [name, `echo LANE:website:${name}`]),
      );
      mkdirSync(path.join(repo, "packages/website"), { recursive: true });
      writeFileSync(
        path.join(repo, "packages/website/package.json"),
        JSON.stringify({ name: "website", scripts }),
      );
      mkdirSync(path.join(repo, "assets/brand"), { recursive: true });
      writeFileSync(path.join(repo, "assets/brand/logo.svg"), "<svg/>\n");
      commitAll(repo, "chore: add website and brand");
    });
    appendFileSync(path.join(repo, "assets/brand/logo.svg"), "<!-- edit -->\n");
    commitAll(repo, "feat: edit the logo");
    const result = prePush(repo);
    const output = result.stdout + result.stderr;
    expect(result.exitCode).toBe(0);
    for (const lane of ["LANE:website:lint", "LANE:website:check", "LANE:website:test"]) {
      expect(output).toContain(lane);
    }
    expect(output).not.toContain("LANE:tooling");
  });

  test("refuses to run a stale installed copy", () => {
    const repo = hookRepo();
    appendFileSync(path.join(repo, "scripts/git/hooks/pre-push"), "# edited\n");
    const result = prePush(repo);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("pre-push hook is stale");
  });
});
