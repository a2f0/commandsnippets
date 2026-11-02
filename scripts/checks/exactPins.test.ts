import {expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import path from 'node:path';

// Every manifest pins exact versions (docs/dependencies.md): a range would let
// an install resolve a release nobody reviewed.
const root = path.resolve(import.meta.dirname, '../..');
const manifests = [
  'package.json',
  'packages/api-shared/package.json',
  'packages/backend-v2/package.json',
  'packages/frontend/package.json',
  'packages/website/package.json',
];
const sections = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
  'overrides',
];
const exact = /^(\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?|workspace:\*)$/;

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.values(value).every(entry => typeof entry === 'string')
  );
}

test.each(manifests)('%s pins exact versions', manifest => {
  const json: unknown = JSON.parse(
    readFileSync(path.join(root, manifest), 'utf8')
  );
  if (typeof json !== 'object' || json === null) {
    throw new Error(`${manifest} is not a JSON object`);
  }
  const ranges = sections.flatMap(section => {
    const entries: unknown = Reflect.get(json, section);
    if (entries === undefined) return [];
    if (!isStringRecord(entries)) {
      throw new Error(`${manifest} ${section} is not a name-to-version map`);
    }
    return Object.entries(entries)
      .filter(([, version]) => !exact.test(version))
      .map(([name, version]) => `${section}.${name}: ${version}`);
  });
  expect(ranges).toEqual([]);
});
