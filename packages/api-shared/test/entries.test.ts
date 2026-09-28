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
      './datetime': './src/datetime.ts',
    });
    expect(packageJson.sideEffects).toBe(false);
  });

  test('./responses loads no request-side module', () => {
    const {modules, packages} = graph('responses.ts');
    expect(modules.filter(isRequestSide)).toEqual([]);
    expect(modules).toContain('resources/documents.ts');
    expect(packages).toEqual(['zod']);
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

  test('. loads every module', () => {
    const all = (dir: string): string[] =>
      readdirSync(dir, {withFileTypes: true}).flatMap(entry =>
        entry.isDirectory()
          ? all(join(dir, entry.name))
          : [relative(SRC, join(dir, entry.name))]
      );
    expect(graph('index.ts').modules).toEqual(all(SRC).sort());
  });
});
