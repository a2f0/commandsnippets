import {describe, expect, it} from 'vitest';
import {type Registry, serialize} from '../../src/lib/jsonapi';

/** A promise and the function that settles it. */
function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>(settle => {
    resolve = settle;
  });
  return {promise, resolve};
}

describe('include paths of one length', () => {
  it('load at once, each load waiting for none of the others', async () => {
    const started: string[] = [];
    const gate = deferred();
    // Each load waits for the gate, which opens once both have started: run
    // one after the other, the first would wait in vain.
    const gated = (type: string) => async (ids: number[]) => {
      started.push(type);
      if (started.length === 2) {
        gate.resolve();
      }
      await Promise.race([
        gate.promise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('loaded one at a time')), 1000)
        ),
      ]);
      return ids.map(id => ({id}));
    };
    const registry = {
      Root: {
        type: 'Root',
        load: async () => [],
        attributes: () => ({}),
        relationships: {
          left: {type: 'Left', key: () => 1},
          right: {type: 'Right', key: () => 2},
        },
        defaultIncludes: [],
      },
      Left: {
        type: 'Left',
        load: gated('Left'),
        attributes: () => ({}),
        relationships: {},
        defaultIncludes: [],
      },
      Right: {
        type: 'Right',
        load: gated('Right'),
        attributes: () => ({}),
        relationships: {},
        defaultIncludes: [],
      },
    } as unknown as Registry;

    const {included} = await serialize(
      registry,
      'Root',
      [{id: 7}],
      'left,right'
    );

    expect(started.sort()).toEqual(['Left', 'Right']);
    expect(included.map(r => `${r.type}:${r.id}`)).toEqual([
      'Left:1',
      'Right:2',
    ]);
  });

  it('share a load in flight rather than make it twice', async () => {
    const loads: Array<{type: string; ids: number[]}> = [];
    const registry = {
      Root: {
        type: 'Root',
        load: async () => [],
        attributes: () => ({}),
        // Two routes to the same middle row, then to its children.
        relationships: {
          first: {type: 'Middle', key: () => 5},
          second: {type: 'Middle', key: () => 5},
        },
        defaultIncludes: [],
      },
      Middle: {
        type: 'Middle',
        load: async (ids: number[]) => {
          loads.push({type: 'Middle', ids});
          return ids.map(id => ({id}));
        },
        attributes: () => ({}),
        relationships: {
          children: {
            type: 'Child',
            many: true,
            load: async (parentIds: number[]) => {
              loads.push({type: 'Middle.children', ids: parentIds});
              // Answered after the other path has asked for it too.
              await new Promise(settle => setTimeout(settle, 5));
              return parentIds.flatMap(parent => [
                {id: parent * 10 + 1, parent},
                {id: parent * 10 + 2, parent},
              ]);
            },
            parentKey: (row: {parent: number}) => row.parent,
          },
        },
        defaultIncludes: [],
      },
      Child: {
        type: 'Child',
        load: async (ids: number[]) => {
          loads.push({type: 'Child', ids});
          return ids.map(id => ({id}));
        },
        attributes: () => ({}),
        relationships: {},
        defaultIncludes: [],
      },
    } as unknown as Registry;

    const {included} = await serialize(
      registry,
      'Root',
      [{id: 1}],
      'first.children,second.children'
    );

    // One load each: the second path waits for the first's, and finds the
    // children (and their linkage) it loaded.
    expect(loads).toEqual([
      {type: 'Middle', ids: [5]},
      {type: 'Middle.children', ids: [5]},
    ]);
    const middle = included.find(r => r.type === 'Middle');
    expect(middle?.relationships?.['children']).toEqual({
      data: [
        {type: 'Child', id: '51'},
        {type: 'Child', id: '52'},
      ],
      meta: {count: 2},
    });
    expect(included.map(r => `${r.type}:${r.id}`)).toEqual([
      'Child:51',
      'Child:52',
      'Middle:5',
    ]);
  });

  it('look a missing row up once', async () => {
    const loads: number[][] = [];
    const registry = {
      Root: {
        type: 'Root',
        load: async () => [],
        attributes: () => ({}),
        relationships: {
          first: {type: 'Gone', key: () => 3},
          second: {type: 'Gone', key: () => 3},
        },
        defaultIncludes: [],
      },
      Gone: {
        type: 'Gone',
        load: async (ids: number[]) => {
          loads.push(ids);
          return [];
        },
        attributes: () => ({}),
        relationships: {},
        defaultIncludes: [],
      },
    } as unknown as Registry;

    const {included} = await serialize(
      registry,
      'Root',
      [{id: 1}],
      'first,second'
    );

    expect(included).toEqual([]);
    expect(loads).toEqual([[3]]);
  });
});
