/**
 * Which CI lanes a change needs, and whether the aggregate `CI gate` passes.
 * See docs/ci-merge-gate.md.
 */

/**
 * Path patterns that make each scope of checks applicable. api-shared (the API
 * contract) also runs the lanes of the packages that consume it, and the brand
 * sources and their image settings (`agent-tool.json`) run the lanes of the web
 * packages that render icons from them. The frontend's spec launchers
 * (`packages/frontend/scripts/`) are shell-linted and tested with the tooling.
 */
export const CI_SCOPES = {
  tooling:
    /^(scripts\/|packages\/frontend\/scripts\/|\.agents\/|\.claude\/|\.codex\/|agent-tool\.json$|\.agent-tool-(skills|permissions)\.json$|commitlint\.config\.mts$|tsconfig[^/]*\.json$)/,
  frontend:
    /^(packages\/(frontend|api-shared)\/|scripts\/testing\/(runUnitTests|runWebdriverTests)\.sh$|assets\/brand\/|agent-tool\.json$)/,
  backendV2: /^packages\/(backend-v2|api-shared)\//,
  apiShared: /^packages\/api-shared\//,
  website: /^(packages\/website\/|assets\/brand\/|agent-tool\.json$)/,
  terraform: /^terraform\//,
} as const satisfies Record<string, RegExp>;

export type CiScope = keyof typeof CI_SCOPES;

/** Changes that can affect every lane run them all. */
const COMMON =
  /^(\.github\/workflows\/|scripts\/checks\/ci|package\.json$|bun\.lock$|bunfig\.toml$|\.mise\.toml$)/;

export function ciDiffRange(
  base: string | undefined,
  head: string | undefined,
): string | undefined {
  if (!base || /^0+$/.test(base)) return undefined;
  if (!/^[a-f0-9]{40}$/.test(base) || !head || !/^[a-f0-9]{40}$/.test(head)) {
    throw new Error("CI diff requires full base and head commit SHAs.");
  }
  return `${base}...${head}`;
}

export function ciScopes(paths: readonly string[]): Record<CiScope, boolean> {
  const common = paths.some((path) => COMMON.test(path));
  return Object.fromEntries(
    Object.entries(CI_SCOPES).map(([scope, pattern]) => [
      scope,
      common || paths.some((path) => pattern.test(path)),
    ]),
  ) as Record<CiScope, boolean>;
}

/** Every lane runs when there is no usable diff (e.g. a new branch push). */
export function allScopes(): Record<CiScope, boolean> {
  return Object.fromEntries(
    Object.keys(CI_SCOPES).map((scope) => [scope, true]),
  ) as Record<CiScope, boolean>;
}
