import { describe, expect, test } from "bun:test";
import { headArgument, selectPushRemote } from "./headRepository";

const config =
  (values: Record<string, string>) =>
  (key: string): string | null =>
    values[key] ?? null;

describe("selectPushRemote", () => {
  test("follows git's precedence", () => {
    const all = {
      "branch.feat/x.pushRemote": "fork",
      "remote.pushDefault": "default",
      "branch.feat/x.remote": "upstream",
    };
    expect(selectPushRemote("feat/x", config(all))).toBe("fork");
    expect(
      selectPushRemote(
        "feat/x",
        config({
          "remote.pushDefault": "default",
          "branch.feat/x.remote": "upstream",
        }),
      ),
    ).toBe("default");
    expect(
      selectPushRemote("feat/x", config({ "branch.feat/x.remote": "upstream" })),
    ).toBe("upstream");
    expect(selectPushRemote("feat/x", config({}))).toBe("origin");
  });
});

describe("headArgument", () => {
  test("uses the bare branch within the base repository", () => {
    expect(headArgument("feat/x", "a2f0/repo", "a2f0/repo")).toBe("feat/x");
    expect(headArgument("feat/x", "A2F0/Repo", "a2f0/repo")).toBe("feat/x");
  });

  test("owner-qualifies a branch pushed to a fork", () => {
    expect(headArgument("feat/x", "a2f0/repo", "someone/repo")).toBe(
      "someone:feat/x",
    );
  });

  test("rejects an unusable head repository", () => {
    expect(() => headArgument("feat/x", "a2f0/repo", "/repo")).toThrow(
      "Could not resolve the owner",
    );
  });
});
