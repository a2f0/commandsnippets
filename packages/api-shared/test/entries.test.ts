import {describe, expect, test} from 'bun:test';
import {readdirSync, readFileSync} from 'node:fs';
import {dirname, join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');

/**
 * The modules a module loads at run time: its imports and re-exports, less
 * `import type` and `export type` (which compile away). An import of only
 * types, `import {type X} from`, counts: `verbatimModuleSyntax` keeps it.
 */
function runtimeImports(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  const statements = source.matchAll(
    /^(?:import|export)\s+(type\s+)?[^;]*?from\s+'([^']+)'/gms
  );
  return [...statements]
    .filter(([, typeOnly]) => typeOnly === undefined)
    .map(([, , specifier]) => specifier as string);
}

/** Every module `entry` loads, directly or not, and the packages it needs. */
function graph(entry: string): {modules: string[]; packages: string[]} {
  const modules = new Set<string>();
  const packages = new Set<string>();
  const visit = (file: string) => {
    if (modules.has(file)) {
      return;
    }
    modules.add(file);
    for (const specifier of runtimeImports(file)) {
      if (specifier.startsWith('.')) {
        visit(`${join(dirname(file), specifier)}.ts`);
      } else {
        packages.add(specifier);
      }
    }
  };
  visit(join(SRC, entry));
  return {
    modules: [...modules].map(file => relative(SRC, file)).sort(),
    packages: [...packages].sort(),
  };
}

const packageJson = JSON.parse(
  readFileSync(join(ROOT, 'package.json'), 'utf8')
) as {exports: Record<string, string>; sideEffects: boolean};

/** Request-side modules: what the API validates with. */
const isRequestSide = (module: string) =>
  /^(fields|filters|include|issues|query|requests)\.ts$|^jsonapi\/request\.ts$|^resources\/requests\//.test(
    module
  );

describe('entry points', () => {
  test('are the package exports, and have no side effects', () => {
    expect(packageJson.exports).toEqual({
      '.': './src/index.ts',
      './responses': './src/responses.ts',
      './requests': './src/requests.ts',
      './messages': './src/messages.ts',
      './cursor': './src/cursor.ts',
      './datetime': './src/datetime.ts',
    });
    expect(packageJson.sideEffects).toBe(false);
  });

  test('./responses loads no request-side module', () => {
    const {modules, packages} = graph('responses.ts');
    expect(modules.filter(isRequestSide)).toEqual([]);
    expect(modules).toContain('resources/documents.ts');
    expect(packages).toEqual(['zod/mini']);
  });

  test('./messages and ./datetime load nothing', () => {
    expect(graph('messages.ts')).toEqual({
      modules: ['messages.ts'],
      packages: [],
    });
    expect(graph('datetime.ts')).toEqual({
      modules: ['datetime.ts'],
      packages: [],
    });
  });

  test('./cursor loads only the datetime parser (no zod)', () => {
    expect(graph('cursor.ts')).toEqual({
      modules: ['cursor.ts', 'datetime.ts'],
      packages: [],
    });
  });

  test('. loads every module', () => {
    expect(graph('index.ts').modules).toEqual(allModules());
  });

  test('mark the schema factories side-effect-free', () => {
    // As zod marks its own: a bundler can then drop a schema built at a
    // module's top level that nothing uses, and with it the modules only that
    // schema needed (a client importing TEXT_ENTRY_SORT_FIELDS from
    // ./requests does not bundle the request validators).
    const unmarked = allModules().flatMap(module => {
      const lines = readFileSync(join(SRC, module), 'utf8').split('\n');
      return lines.flatMap((line, index) => {
        const name = /^export function (\w+(?:Schema|Field))\b/.exec(line)?.[1];
        return name !== undefined &&
          lines[index - 1]?.trim() !== '// @__NO_SIDE_EFFECTS__'
          ? [`${module}: ${name}`]
          : [];
      });
    });
    expect(unmarked).toEqual([]);
  });
});

/** Every module in src/, sorted. */
function allModules(dir = SRC): string[] {
  return readdirSync(dir, {withFileTypes: true})
    .flatMap(entry =>
      entry.isDirectory()
        ? allModules(join(dir, entry.name))
        : [relative(SRC, join(dir, entry.name))]
    )
    .sort();
}
