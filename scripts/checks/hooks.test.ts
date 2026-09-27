import { afterEach, describe, expect, test } from "bun:test";
import {
  appendFileSync,
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const STRIP = path.join(REPO_ROOT, "scripts/checks/stripClaudeCoauthors.sh");
const TRUST = path.join(REPO_ROOT, "scripts/checks/checkCommitTrust.sh");

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

function run(command: string[], cwd: string) {
  const result = Bun.spawnSync(command, {
    cwd,
    env: {
      ...process.env,
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

function strip(message: string): { message: string; stderr: string } {
  const file = path.join(tempDir(), "COMMIT_EDITMSG");
  writeFileSync(file, message);
  const result = run(["sh", STRIP, file], REPO_ROOT);
  expect(result.exitCode).toBe(0);
  return { message: readFileSync(file, "utf8"), stderr: result.stderr };
}

describe("stripClaudeCoauthors.sh", () => {
  test("removes Claude co-author trailers and the Claude Code footer", () => {
    const { message, stderr } = strip(
      [
        "feat(app): add widget",
        "",
        "Body text.",
        "",
        "🤖 Generated with [Claude Code](https://claude.com/claude-code)",
        "",
        "Co-Authored-By: Claude <noreply@anthropic.com>",
        "co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>",
        "",
      ].join("\n"),
    );
    expect(message).toBe("feat(app): add widget\n\nBody text.\n");
    expect(stderr).toContain("Stripped 3 Claude attribution line(s)");
  });

  test("matches an anthropic.com address even without the Claude name", () => {
    const { message } = strip(
      "fix: thing\n\nCo-authored-by: Bot <bot@anthropic.com>\n",
    );
    expect(message).toBe("fix: thing\n");
  });

  test("keeps human co-authors and leaves clean messages untouched", () => {
    const human = "fix: thing\n\nCo-authored-by: Ada <ada@example.com>\n";
    expect(strip(human).message).toBe(human);
    const clean = "chore: tidy\n\nMentions claude in prose, which stays.\n";
    const result = strip(clean);
    expect(result.message).toBe(clean);
    expect(result.stderr).toBe("");
  });
});

/** A scratch repo whose commits are SSH-signed with a throwaway key. */
function signedRepo(): string {
  const dir = tempDir();
  const key = path.join(dir, "signing-key");
  expect(
    run(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-f", key], dir)
      .exitCode,
  ).toBe(0);
  // Without an allowed-signers file git reports SSH signatures as "N"
  // (unsigned), which checkCommitTrust would rightly reject.
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

describe("checkCommitTrust.sh", () => {
  test("accepts signed commits without co-author trailers", () => {
    const repo = signedRepo();
    commit(repo, "feat: signed work");
    expect(run(["sh", TRUST, "--range", "HEAD~1..HEAD"], repo).exitCode).toBe(
      0,
    );
  });

  test("rejects unsigned commits", () => {
    const repo = signedRepo();
    commit(repo, "feat: unsigned work", false);
    const result = run(["sh", TRUST, "--range", "HEAD~1..HEAD"], repo);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("missing or invalid signature");
  });

  test("rejects any Co-authored-by trailer with rewrite instructions", () => {
    const repo = signedRepo();
    commit(
      repo,
      "feat: pairing\n\nCo-authored-by: Claude <noreply@anthropic.com>",
    );
    const result = run(["sh", TRUST, "--range", "HEAD~1..HEAD"], repo);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Co-authored-by trailer");
    expect(result.stderr).toContain("AGENT INSTRUCTION");
  });

  test("fails closed on an invalid range", () => {
    const repo = signedRepo();
    const result = run(["sh", TRUST, "--range", "nope..HEAD"], repo);
    expect(result.exitCode).toBe(1);
  });
});

describe("install-hooks.sh", () => {
  test("installs every hook, prunes stale ones, and sets core.hooksPath", () => {
    const repo = path.join(tempDir(), "repo");
    expect(run(["git", "init", "-q", "-b", "main", repo], REPO_ROOT).exitCode).toBe(0);
    cpSync(path.join(REPO_ROOT, "scripts/git"), path.join(repo, "scripts/git"), {
      recursive: true,
    });
    const hooksDir = path.join(repo, ".git/hooks");
    writeFileSync(path.join(hooksDir, "pre-rebase"), "#!/bin/sh\nexit 1\n");
    chmodSync(path.join(hooksDir, "pre-rebase"), 0o755);

    const result = run(["sh", "scripts/git/install-hooks.sh"], repo);
    expect(result.exitCode).toBe(0);
    for (const hook of ["commit-msg", "pre-push"]) {
      const installed = path.join(hooksDir, hook);
      expect(readFileSync(installed, "utf8")).toBe(
        readFileSync(path.join(REPO_ROOT, "scripts/git/hooks", hook), "utf8"),
      );
      expect(statSync(installed).mode & 0o111).not.toBe(0);
    }
    expect(existsSync(path.join(hooksDir, "pre-rebase"))).toBe(false);
    expect(result.stdout).toContain("Removed stale pre-rebase hook");
    expect(
      realpathSync(run(["git", "config", "core.hooksPath"], repo).stdout.trim()),
    ).toBe(realpathSync(hooksDir));
  });
});

describe("lintBranchName.ts", () => {
  const lint = (name: string) =>
    run(["bun", "scripts/checks/lintBranchName.ts", name], REPO_ROOT);

  test.each([
    "main",
    "staging",
    "feat/backend-v2",
    "chore/ship-pr-flow",
    "fix/a.b_c",
  ])(
    "accepts %s",
    (name) => {
      expect(lint(name).exitCode).toBe(0);
    },
  );

  test.each(["backend-v2", "Feat/x", "nope/x", `feat/${"x".repeat(50)}`])(
    "rejects %s",
    (name) => {
      expect(lint(name).exitCode).toBe(1);
    },
  );
});

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
   * scripts stubbed so a run shows which checks it triggered.
   */
  function hookRepo(): string {
    const repo = signedRepo();
    for (const dir of ["scripts/git", "scripts/lib"]) {
      cpSync(path.join(REPO_ROOT, dir), path.join(repo, dir), {
        recursive: true,
      });
    }
    mkdirSync(path.join(repo, "scripts/checks"));
    cpSync(TRUST, path.join(repo, "scripts/checks/checkCommitTrust.sh"));
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
    expect(run(["sh", "scripts/git/install-hooks.sh"], repo).exitCode).toBe(0);
    git(repo, "switch", "-q", "-c", "feat/x");
    return repo;
  }

  function prePush(
    repo: string,
    sha = git(repo, "rev-parse", "HEAD"),
    env: Record<string, string> = {},
  ) {
    const result = Bun.spawnSync([".git/hooks/pre-push", "origin", "url"], {
      cwd: repo,
      stdin: Buffer.from(`refs/heads/feat/x ${sha} refs/heads/feat/x ${ZERO}\n`),
      env: {
        ...process.env,
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
    expect(result.stderr).toContain("Co-authored-by trailer");
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

  test("refuses to run a stale installed copy", () => {
    const repo = hookRepo();
    appendFileSync(path.join(repo, "scripts/git/hooks/pre-push"), "# edited\n");
    const result = prePush(repo);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("pre-push hook is stale");
  });
});
