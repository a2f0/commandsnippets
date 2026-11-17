import {expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import path from 'node:path';

// New releases wait a day before they install (docs/dependencies.md), except
// the packages a2f0 publishes from its own reviewed repositories. Bun matches
// excluded names exactly, so every internal package must be listed by name.
const root = path.resolve(import.meta.dirname, '../..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');
const internal = /"(@a2f0\/[^"@/]+)"/g;

const {install} = Bun.TOML.parse(read('bunfig.toml')) as {
  install?: {minimumReleaseAge?: unknown; minimumReleaseAgeExcludes?: unknown};
};

test('new releases wait a day', () => {
  expect(install?.minimumReleaseAge).toBe(86_400);
});

test('exactly the internal packages skip the wait', () => {
  const manifests = [
    'package.json',
    ...new Bun.Glob('packages/*/package.json').scanSync(root),
  ];
  expect(manifests).toContain('packages/frontend/package.json');
  const names = new Set(
    [...manifests, 'bun.lock'].flatMap(file =>
      [...read(file).matchAll(internal)].map(match => match[1])
    )
  );
  expect(names.size).toBeGreaterThan(0);
  expect(install?.minimumReleaseAgeExcludes).toEqual([...names].sort());
});
