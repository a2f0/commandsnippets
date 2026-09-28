// @vitest-environment node
import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {errorObjectSchema} from '@commandsnippets/api-shared/responses';
import {describe, expect, it} from 'vitest';
import * as z from 'zod/mini';

import {parseBody} from '../../../../src/lib/api/parseResponse';

const SRC = fileURLToPath(new URL('../../../../src/', import.meta.url));

/** Every TypeScript file under `dir`. */
function sources(dir: string): string[] {
  return readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return sources(path);
    }
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe('zod in the bundle', () => {
  it("is api-shared's zod/mini: one copy", () => {
    expect(Object.getPrototypeOf(errorObjectSchema)).toBe(
      Object.getPrototypeOf(z.object({}))
    );
  });

  it('never classic zod, which would add all of it (about 20 kB gzipped)', () => {
    const classic = sources(SRC).filter(file =>
      /^import\s+(?!type\b)[^;]*?from\s+'zod'/m.test(readFileSync(file, 'utf8'))
    );
    expect(classic).toEqual([]);
  });

  it("describes issues in English (zod/mini's own messages)", () => {
    expect(() => parseBody(z.string(), 5, 'Failed')).toThrow(
      'Failed: invalid response ((document): Invalid input: expected string, ' +
        'received number)'
    );
  });
});
