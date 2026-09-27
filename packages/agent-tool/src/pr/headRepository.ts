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
