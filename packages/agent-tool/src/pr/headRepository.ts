import { spawnSync } from "node:child_process";

/** Reads one git config value, or null when it is unset. */
export type GitConfigReader = (key: string) => string | null;

/**
 * The remote `git push` sends a branch to, in git's own precedence:
 * `branch.<name>.pushRemote`, then `remote.pushDefault`, then the branch's
 * upstream remote, then `origin`. In a fork checkout this is the fork, not the
 * repository the PR targets.
 */
export function selectPushRemote(
  branch: string,
  readConfig: GitConfigReader,
): string {
  return (
    readConfig(`branch.${branch}.pushRemote`) ??
    readConfig("remote.pushDefault") ??
    readConfig(`branch.${branch}.remote`) ??
    "origin"
  );
}

/**
 * The `gh pr create --head` value: the bare branch when it lives in the base
 * repository, `<owner>:<branch>` when it was pushed to a fork.
 */
export function headArgument(
  branch: string,
  baseRepo: string,
  headRepo: string,
): string {
  if (headRepo.toLowerCase() === baseRepo.toLowerCase()) {
    return branch;
  }
  const [owner = ""] = headRepo.split("/");
  if (owner.length === 0) {
    throw new Error(`Could not resolve the owner of '${headRepo}'.`);
  }
  return `${owner}:${branch}`;
}

function capture(command: string, args: string[]): string | null {
  const result = spawnSync(command, args, { encoding: "utf8" });
  const value = result.status === 0 ? result.stdout.trim() : "";
  return value.length > 0 ? value : null;
}

/**
 * Where a branch is pushed: the push remote's URL and the repository it names.
 * In a fork checkout that is the fork, not the PR's base repository.
 */
export function resolvePushedHead(branch: string): {
  readonly url: string;
  readonly repo: string;
} {
  const remote = selectPushRemote(branch, (key) =>
    capture("git", ["config", "--get", key]),
  );
  const url = capture("git", ["remote", "get-url", "--push", remote]);
  if (url === null) {
    throw new Error(`Could not resolve the URL of push remote '${remote}'.`);
  }
  const repo = capture("gh", [
    "repo",
    "view",
    url,
    "--json",
    "nameWithOwner",
    "--jq",
    ".nameWithOwner",
  ]);
  if (repo === null) {
    throw new Error(`Could not resolve the repository for remote '${remote}'.`);
  }
  return { url, repo };
}

/**
 * The first PR in a `gh pr list --json number,headRepository` listing whose
 * head lives in `headRepo`, or "" when none does. `--head` filters by branch
 * name only, so another fork's same-named branch would otherwise match.
 */
export function selectPrForHead(listing: string, headRepo: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(listing);
  } catch {
    throw new Error("Could not parse the open PR listing.");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("Could not parse the open PR listing.");
  }
  for (const pr of parsed) {
    const number: unknown = pr?.number;
    const nameWithOwner: unknown = pr?.headRepository?.nameWithOwner;
    if (
      typeof number === "number" &&
      typeof nameWithOwner === "string" &&
      nameWithOwner.toLowerCase() === headRepo.toLowerCase()
    ) {
      return String(number);
    }
  }
  return "";
}
