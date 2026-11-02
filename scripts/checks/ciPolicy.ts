/**
 * Which CI lanes a change needs, and whether the aggregate `CI gate` passes.
 * See docs/ci-merge-gate.md.
 */

/**
 * Path patterns that make each scope of checks applicable. api-shared (the API
 * contract) also runs the lanes of the packages that consume it, and the brand
 * sources and their image settings (`agent-tool.json`) run the lanes of the web
 * packages that render icons from them. The frontend's spec launchers
 * (`packages/frontend/scripts/`) are shell-linted and tested with the tooling,
 * and the root typecheck covers Terraform's TypeScript (`terraform/scripts/`).
 */
export const CI_SCOPES = {
  tooling:
    /^(scripts\/|packages\/frontend\/scripts\/|terraform\/scripts\/[^/]+\.ts$|\.agents\/|\.claude\/|\.codex\/|agent-tool\.json$|\.agent-tool-(skills|permissions)\.json$|commitlint\.config\.mts$|tsconfig[^/]*\.json$)/,
  frontend:
    /^(packages\/(frontend|api-shared)\/|scripts\/testing\/(runUnitTests|runWebdriverTests)\.sh$|assets\/brand\/|agent-tool\.json$)/,
  backendV2: /^packages\/(backend-v2|api-shared)\//,
  apiShared: /^packages\/api-shared\//,
  website: /^(packages\/website\/|assets\/brand\/|agent-tool\.json$)/,
  terraform: /^terraform\//,
} as const satisfies Record<string, RegExp>;

export type CiScope = keyof typeof CI_SCOPES;

/**
 * Changes that can affect every lane run them all, including the root
 * `biome.json`, which every package's config extends, and `knip.config.ts`,
 * which every package's lint reads.
 */
const COMMON =
  /^(\.github\/(workflows|actions)\/|scripts\/checks\/ci|package\.json$|bun\.lock$|bunfig\.toml$|\.mise\.toml$|biome\.json$|knip\.config\.ts$)/;

export function ciDiffRange(
  base: string | undefined,
  head: string | undefined
): string | undefined {
  if (!base || /^0+$/.test(base)) return undefined;
  if (!/^[a-f0-9]{40}$/.test(base) || !head || !/^[a-f0-9]{40}$/.test(head)) {
    throw new Error('CI diff requires full base and head commit SHAs.');
  }
  return `${base}...${head}`;
}

/** Each scope, applicable or not by `applies`. */
function scopesWhere(
  applies: (scope: CiScope) => boolean
): Record<CiScope, boolean> {
  return {
    tooling: applies('tooling'),
    frontend: applies('frontend'),
    backendV2: applies('backendV2'),
    apiShared: applies('apiShared'),
    website: applies('website'),
    terraform: applies('terraform'),
  };
}

export function ciScopes(paths: readonly string[]): Record<CiScope, boolean> {
  const common = paths.some(path => COMMON.test(path));
  return scopesWhere(
    scope => common || paths.some(path => CI_SCOPES[scope].test(path))
  );
}

/** Every lane runs when there is no usable diff (e.g. a new branch push). */
export function allScopes(): Record<CiScope, boolean> {
  return scopesWhere(() => true);
}
