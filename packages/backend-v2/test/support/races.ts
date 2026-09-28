/** D1 bindings that let a competing write land at a chosen moment. */
import {env} from 'cloudflare:workers';

/**
 * Bindings whose D1 runs `competitor` immediately before the first statement
 * inserting into `table` executes: the narrowest race window left once a
 * create computes its rank inside the INSERT itself.
 */
export function raceBeforeInsert(
  table: string,
  competitor: () => Promise<unknown>
): Cloudflare.Env {
  return raceBeforeStatement(
    new RegExp(`^\\s*insert into "${table}"`, 'i'),
    competitor
  );
}

/**
 * Bindings whose D1 runs `competitor` immediately before the first statement
 * matching `pattern` executes.
 */
export function raceBeforeStatement(
  pattern: RegExp,
  competitor: () => Promise<unknown>
): Cloudflare.Env {
  let fired = false;
  // D1's batch() needs the native statements back, and their query text.
  const natives = new WeakMap<
    object,
    {statement: D1PreparedStatement; query: string}
  >();
  const wrap = (
    statement: D1PreparedStatement,
    query: string
  ): D1PreparedStatement => {
    const proxy = new Proxy(statement, {
      get(target, property) {
        const value = Reflect.get(target, property);
        if (property === 'bind') {
          return (...args: unknown[]) => wrap(target.bind(...args), query);
        }
        if (
          ['run', 'all', 'raw', 'first'].includes(String(property)) &&
          !fired &&
          pattern.test(query)
        ) {
          return async (...args: unknown[]) => {
            fired = true;
            await competitor();
            return (value as (...a: unknown[]) => unknown).apply(target, args);
          };
        }
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    natives.set(proxy, {statement, query});
    return proxy;
  };
  const database = new Proxy(env.DB, {
    get(target, property) {
      if (property === 'prepare') {
        return (query: string) => wrap(target.prepare(query), query);
      }
      if (property === 'batch') {
        return async (statements: D1PreparedStatement[]) => {
          const unwrapped = statements.map(
            statement => natives.get(statement) ?? {statement, query: ''}
          );
          if (!fired && unwrapped.some(({query}) => pattern.test(query))) {
            fired = true;
            await competitor();
          }
          return target.batch(unwrapped.map(({statement}) => statement));
        };
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
