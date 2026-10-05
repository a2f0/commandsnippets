// @vitest-environment node
import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {decomposeColor} from '@mui/material/styles';
import {describe, expect, it} from 'vitest';

import {darkTheme, lightTheme} from '../../../src/theme/themes';

const root = fileURLToPath(new URL('../../..', import.meta.url));

/** A CSS color literal: hex, `rgb(a)` or `hsl(a)`. */
const COLOR =
  /(?<![\w-])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b|\b(?:rgb|hsl)a?\([^)]*\)/gi;

/** Whether `color` is a gray: no hue, at any lightness and alpha. */
function isGray(color: string): boolean {
  const {type, values} = decomposeColor(color);
  if (type.startsWith('hsl')) {
    return values[1] === 0;
  }
  return values[0] === values[1] && values[1] === values[2];
}

/** The colors in `text` that are not gray. */
const huesIn = (text: string) =>
  (text.match(COLOR) ?? []).filter(color => !isGray(color));

describe.each([
  ['light', lightTheme],
  ['dark', darkTheme],
])('the %s theme', (_mode, theme) => {
  it.each([
    'primary',
    'secondary',
    'error',
    'warning',
    'info',
    'success',
  ] as const)('makes %s gray', name => {
    const {main, light, dark, contrastText} = theme.palette[name];
    expect([main, light, dark, contrastText].filter(c => !isGray(c))).toEqual(
      []
    );
  });

  it('has no color but grays', () => {
    expect(huesIn(JSON.stringify(theme))).toEqual([]);
  });
});

describe('the app', () => {
  it('hard-codes no color but grays', () => {
    const files = [
      ...readdirSync(join(root, 'src'), {recursive: true, encoding: 'utf8'})
        .filter(file => /\.(tsx?|css|svg)$/.test(file))
        .map(file => join('src', file)),
      ...readdirSync(join(root, 'public'))
        .filter(file => file.endsWith('.svg'))
        .map(file => join('public', file)),
      'index.html',
    ];
    const hues = files.flatMap(file =>
      huesIn(readFileSync(join(root, file), 'utf8')).map(
        color => `${file}: ${color}`
      )
    );
    expect(hues).toEqual([]);
  });
});
