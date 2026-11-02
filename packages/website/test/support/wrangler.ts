import {readFileSync} from 'node:fs';

/** The parts of a `wrangler.jsonc` the tests check. */
export interface WranglerEnv {
  vars: Record<string, string>;
  routes: {pattern: string; custom_domain: boolean}[];
  workers_dev: boolean | undefined;
}

export interface Wrangler {
  vars: Record<string, string>;
  env: Record<string, WranglerEnv>;
  assets: {directory: string; not_found_handling: string} | undefined;
  compatibility_flags: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function record(value: unknown, what: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${what} is not an object`);
  return value;
}

function text(value: unknown, what: string): string {
  if (typeof value !== 'string') throw new Error(`${what} is not a string`);
  return value;
}

function list(value: unknown, what: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${what} is not an array`);
  return value;
}

function strings(value: unknown, what: string): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record(value, what)).map(([name, entry]) => [
      name,
      text(entry, `${what}.${name}`),
    ])
  );
}

function optionalBoolean(value: unknown, what: string): boolean | undefined {
  if (value === undefined || typeof value === 'boolean') return value;
  throw new Error(`${what} is not a boolean`);
}

function environment(value: unknown, what: string): WranglerEnv {
  const env = record(value, what);
  return {
    vars: strings(env.vars ?? {}, `${what}.vars`),
    routes: list(env.routes ?? [], `${what}.routes`).map((entry, index) => {
      const route = record(entry, `${what}.routes[${index}]`);
      return {
        pattern: text(route.pattern, `${what}.routes[${index}].pattern`),
        custom_domain: route.custom_domain === true,
      };
    }),
    workers_dev: optionalBoolean(env.workers_dev, `${what}.workers_dev`),
  };
}

/**
 * Reads a `wrangler.jsonc` (comments and trailing commas allowed), checking
 * the shape of the parts the tests read.
 */
export function readWrangler(path: string): Wrangler {
  const config = record(
    Bun.JSONC.parse(readFileSync(path, 'utf8')),
    'wrangler.jsonc'
  );
  const assets =
    config.assets === undefined ? undefined : record(config.assets, 'assets');
  return {
    vars: strings(config.vars ?? {}, 'vars'),
    env: Object.fromEntries(
      Object.entries(record(config.env ?? {}, 'env')).map(([name, env]) => [
        name,
        environment(env, `env.${name}`),
      ])
    ),
    assets: assets && {
      directory: text(assets.directory, 'assets.directory'),
      not_found_handling: text(
        assets.not_found_handling,
        'assets.not_found_handling'
      ),
    },
    compatibility_flags: list(
      config.compatibility_flags ?? [],
      'compatibility_flags'
    ).map((flag, index) => text(flag, `compatibility_flags[${index}]`)),
  };
}
