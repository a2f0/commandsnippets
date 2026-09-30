import { describe, expect, test } from "bun:test";

import {
  type AgentToolActions,
  runAgentToolAction,
} from "./runAgentToolAction";

function actionsWith(overrides: Partial<AgentToolActions>): AgentToolActions {
  return {
    bumpVersions: () => 0,
    checkVersions: () => 0,
    openPr: () => 0,
    resolveVersionConflicts: () => 0,
    solicitClaudeCodeReview: () => 0,
    solicitCodexReview: () => 0,
    solicitOpencodeReview: () => 0,
    squashMerge: () => 0,
    ...overrides,
  };
}

describe("runAgentToolAction", () => {
  test("exposes squashMerge with every reviewed-merge positional", () => {
    let received: readonly (string | undefined)[] = [];
    const actions = actionsWith({
      squashMerge: (rootDir, subject, expectedHeadSha, expectedBaseRef) => {
        received = [rootDir, subject, expectedHeadSha, expectedBaseRef];
        return 17;
      },
    });

    expect(
      runAgentToolAction(
        "/repo",
        ["squashMerge", "", "abc123", "main"],
        actions,
      ),
    ).toBe(17);
    expect(received).toEqual(["/repo", "", "abc123", "main"]);
  });

  test("rejects flags or extra positionals that squashMerge cannot consume", () => {
    expect(() =>
      runAgentToolAction(
        "/repo",
        ["squashMerge", "", "abc123", "main", "--keep-branch"],
        actionsWith({}),
      ),
    ).toThrow("squashMerge accepts at most 3 positional arguments");
  });

  test("exposes the other public agent-tool functions", () => {
    const calls: string[] = [];
    const actions = actionsWith({
      openPr: () => {
        calls.push("openPr");
        return 0;
      },
      solicitClaudeCodeReview: () => {
        calls.push("solicitClaudeCodeReview");
        return 0;
      },
      solicitCodexReview: () => {
        calls.push("solicitCodexReview");
        return 0;
      },
      solicitOpencodeReview: () => {
        calls.push("solicitOpencodeReview");
        return 0;
      },
    });

    runAgentToolAction("/repo", ["openPr"], actions);
    runAgentToolAction("/repo", ["solicitClaudeCodeReview"], actions);
    runAgentToolAction("/repo", ["solicitCodexReview"], actions);
    runAgentToolAction("/repo", ["solicitOpencodeReview"], actions);

    expect(calls).toEqual([
      "openPr",
      "solicitClaudeCodeReview",
      "solicitCodexReview",
      "solicitOpencodeReview",
    ]);
  });

  test("exposes the version actions with the base OID", () => {
    const calls: (string | undefined)[][] = [];
    const actions = actionsWith({
      bumpVersions: (_rootDir, baseOid) => {
        calls.push(["bumpVersions", baseOid]);
        return 0;
      },
      checkVersions: (_rootDir, baseOid) => {
        calls.push(["checkVersions", baseOid]);
        return 1;
      },
      resolveVersionConflicts: () => {
        calls.push(["resolveVersionConflicts"]);
        return 0;
      },
    });

    expect(runAgentToolAction("/repo", ["bumpVersions", "abc"], actions)).toBe(
      0,
    );
    expect(runAgentToolAction("/repo", ["checkVersions", "abc"], actions)).toBe(
      1,
    );
    runAgentToolAction("/repo", ["resolveVersionConflicts"], actions);

    expect(calls).toEqual([
      ["bumpVersions", "abc"],
      ["checkVersions", "abc"],
      ["resolveVersionConflicts"],
    ]);
    expect(() =>
      runAgentToolAction(
        "/repo",
        ["resolveVersionConflicts", "extra"],
        actions,
      ),
    ).toThrow("resolveVersionConflicts accepts at most 0 positional arguments");
  });
});
