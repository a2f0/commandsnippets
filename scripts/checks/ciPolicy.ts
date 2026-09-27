/**
 * Which CI lanes a change needs, and whether the aggregate `CI gate` passes.
 * See docs/ci-merge-gate.md.
 */

/** Path patterns that make each scope of checks applicable. */
export const CI_SCOPES = {
  tooling:
    /^(packages\/|scripts\/|commitlint\.config\.mts$|tsconfig[^/]*\.json$)/,
  backend:
    /^(backend\/|scripts\/(deployApi|deployProductionApi|deployStagingApi|runBackendTests)\.sh$)/,
  frontend:
    /^(frontend\/|scripts\/(deployApp|deployProductionApp|deployStagingApp|runElectronTests|runUnitTests|runWebdriverTests)\.sh$)/,
  mobile: /^(frontend\/|scripts\/runCapacitorTests\.sh$)/,
  backendV2: /^backend-v2\//,
} as const satisfies Record<string, RegExp>;

export type CiScope = keyof typeof CI_SCOPES;

/** Each scoped job in .github/workflows/ci.yml, by job id, and its scope. */
export const CI_JOBS = {
  tooling: "tooling",
  backend: "backend",
  "backend-v2": "backendV2",
  frontend: "frontend",
  ios: "mobile",
} as const satisfies Record<string, CiScope>;

/** Changes that can affect every lane run them all. */
const COMMON =
  /^(\.github\/workflows\/|scripts\/checks\/ci|package\.json$|bun\.lock$)/;

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

interface JobResult {
  readonly result: string;
  readonly outputs?: Readonly<Record<string, string>>;
}

// A skipped job is safe only when successful change detection explicitly says
// it is irrelevant. Failed/cancelled prerequisites must never turn the gate green.
export function assertCiSuccess(
  needs: Readonly<Record<string, JobResult | undefined>>,
): void {
  const { changes } = needs;
  if (changes?.result !== "success") {
    throw new Error(`changes did not succeed: ${changes?.result ?? "missing"}`);
  }
  for (const [job, scopeName] of Object.entries(CI_JOBS)) {
    const scope = changes.outputs?.[scopeName];
    if (scope !== "true" && scope !== "false") {
      throw new Error(`Missing or invalid change scope: ${scopeName}`);
    }
    const expected = scope === "true" ? "success" : "skipped";
    if (needs[job]?.result !== expected) {
      throw new Error(
        `${job} must be ${expected}: ${needs[job]?.result ?? "missing"}`,
      );
    }
  }
}
