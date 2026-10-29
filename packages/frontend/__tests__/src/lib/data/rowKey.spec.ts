import {describe, expect, it} from 'vitest';

import {keyOfRow} from '../../../../src/lib/data/rowKey';

describe('keyOfRow', () => {
  it('keys a row made here by its local id, after the API gave it its own', () => {
    expect(keyOfRow({id: '7', localId: 'local-1'})).toBe('local-1');
  });

  it('keys a row read from the API by its id', () => {
    expect(keyOfRow({id: '7'})).toBe('7');
    expect(keyOfRow({id: '7', localId: undefined})).toBe('7');
  });
});
