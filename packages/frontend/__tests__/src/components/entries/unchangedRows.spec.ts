import {
  keepUnchanged,
  sameData,
} from '../../../../src/components/entries/unchangedRows';

describe('sameData', () => {
  it('compares values read from the database by what they hold', () => {
    expect(
      sameData({a: 1, b: {c: [1, 'x', null]}}, {b: {c: [1, 'x', null]}, a: 1})
    ).toBe(true);
    expect(sameData({a: 1}, {a: 2})).toBe(false);
    expect(sameData({a: {b: [1]}}, {a: {b: [1, 2]}})).toBe(false);
    expect(sameData({a: 1}, {a: 1, b: 2})).toBe(false);
    expect(sameData({a: 1, b: 2}, {a: 1, c: 2})).toBe(false);
    expect(sameData([], {})).toBe(false);
    expect(sameData(null, {})).toBe(false);
    expect(sameData('1', 1)).toBe(false);
  });
});

describe('keepUnchanged', () => {
  const keyOf = (row: {id: string; localId?: string}) => row.localId ?? row.id;

  it('keeps the object of each row unchanged, by key', () => {
    const kept = {id: '1', count: 0};
    const changed = {id: '2', count: 0};
    const previous = new Map([
      ['1', kept],
      ['2', changed],
    ]);
    const read = [
      {id: '3', count: 0},
      {id: '2', count: 1},
      {id: '1', count: 0},
    ];

    const rows = keepUnchanged(read, previous, keyOf);

    expect(rows).toEqual(read);
    expect(rows[0]).toBe(read[0]);
    expect(rows[1]).toBe(read[1]);
    expect(rows[2]).toBe(kept);
  });

  it('takes a row whose id the API replaced as changed', () => {
    const before = {id: 'local-1', localId: 'local-1'};
    const read = [{id: '42', localId: 'local-1'}];

    const [row] = keepUnchanged(read, new Map([['local-1', before]]), keyOf);

    expect(row).toBe(read[0]);
  });
});
