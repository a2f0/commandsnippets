import {describe, expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';

/** A tsconfig's compilerOptions (JSON with comments). */
function compilerOptions(url: URL): Record<string, unknown> {
  const text = readFileSync(url, 'utf8').replace(/^\s*\/\/.*$/gm, '');
  return JSON.parse(text).compilerOptions;
}

describe('tsconfig.json', () => {
  test("has every @tsconfig/strictest option, as the web app's", () => {
    const strictest = compilerOptions(
      new URL(
        '../node_modules/@tsconfig/strictest/tsconfig.json',
        import.meta.url
      )
    );
    const own = compilerOptions(new URL('../tsconfig.json', import.meta.url));
    expect(own).toMatchObject(strictest);
  });
});
