import { afterEach, describe, expect, test } from "bun:test";
import {
  chmodSync,
  cpSync,
  existsSync,
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

  test.each(["main", "feat/backend-v2", "chore/ship-pr-flow", "fix/a.b_c"])(
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
