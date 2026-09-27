import {env} from 'cloudflare:workers';
import {describe, expect, it, vi} from 'vitest';
import {describeError} from '../../src/lib/errors';
import {ApiClient} from '../helpers';

/** Bindings whose D1 fails every statement that touches `table`. */
function failingTable(table: string): Cloudflare.Env {
  const failing = (statement: D1PreparedStatement): D1PreparedStatement =>
    new Proxy(statement, {
      get(target, property) {
        if (property === 'bind') {
          return (...args: unknown[]) => failing(target.bind(...args));
        }
        if (['run', 'all', 'raw', 'first'].includes(String(property))) {
          return async () => {
            throw new Error('D1_ERROR: simulated outage');
          };
        }
        const value = Reflect.get(target, property);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  const database = new Proxy(env.DB, {
    get(target, property) {
      if (property === 'prepare') {
        return (query: string) =>
          query.includes(`"${table}"`)
            ? failing(target.prepare(query))
            : target.prepare(query);
      }
      const value = Reflect.get(target, property);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return new Proxy(env, {
    get: (target, property) =>
      property === 'DB' ? database : Reflect.get(target, property),
  });
}

describe('unexpected error logging', () => {
  it('never logs SQL parameters such as auth token keys', async () => {
    const secret = `${'c0ffee'.repeat(6).slice(0, 36)}beef`;
    const logged: string[] = [];
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      logged.push(args.map(String).join(' '));
    });

    const response = await new ApiClient(
      secret,
      failingTable('authtoken_token')
    ).get('/api/v1/user/');

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      errors: [
        {detail: 'A server error occurred.', status: '500', code: 'error'},
      ],
    });
    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain('params: [redacted]');
    expect(logged[0]).toContain('simulated outage');
    expect(logged.join('\n')).not.toContain(secret);
  });

  it('describes non-Error throws without their contents', () => {
    expect(describeError('secret-string')).toBe('Non-Error thrown: string');
    expect(describeError(new TypeError('plain'))).toBe('TypeError: plain');
  });
});
