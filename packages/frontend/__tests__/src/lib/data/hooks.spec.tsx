import {act, render, waitFor} from '@testing-library/react';
import {Dexie, liveQuery} from 'dexie';
import {describe, expect, it, vi} from 'vitest';

import {
  useEntries,
  useSession,
  useTagNamed,
  useTags,
} from '../../../../src/lib/data/hooks';
import * as timings from '../../../../src/lib/metrics/timings';
import {
  clearMetrics,
  metricsSnapshot,
} from '../../../../src/lib/metrics/timings';
import {type SyncSession, syncSession} from '../../../../src/lib/sync/session';
import {signIn, TEST_USER} from '../../../util/signIn';
import {entry, junction, seed, tag} from '../../../util/storeFixtures';

/** How many times the tags were read from the database. */
const tagReads = () =>
  metricsSnapshot().timings.filter(({name}) => name === 'useTags').length;

/**
 * Count the hooks' queries from now on: how many of `name` (`useTags`,
 * `useEntries(all)`) have started, each counted as it starts (`timed`), with
 * no wait for the HUD's notification.
 */
function countQueries(): (name: string) => number {
  const timedSpy = vi.spyOn(timings, 'timed');
  return name => timedSpy.mock.calls.filter(([, ran]) => ran === name).length;
}

describe('useSession', () => {
  it('opens the next session when another tab signs out and in', async () => {
    signIn();
    const shown: Array<SyncSession | null> = [];
    const Probe = () => {
      shown.push(useSession());
      return null;
    };
    render(<Probe />);
    const first = syncSession(TEST_USER);
    expect(shown.at(-1)).toBe(first);
    await first.db.open();

    // Another tab's sign-out deletes the database (its sign-in opens anew).
    await act(async () => Dexie.delete(first.db.name));

    await waitFor(() => expect(shown.at(-1)).not.toBe(first));
    expect(shown.at(-1)).toBe(syncSession(TEST_USER));
  });
});

describe('useTags', () => {
  it('reads the tags once for every reader, and again on a change', async () => {
    signIn();
    await seed([tag('1', {name: 'shell'}), tag('2', {name: 'git'})]);
    clearMetrics();
    const seen: Record<string, number | undefined> = {};
    const Reader = ({name}: {name: string}) => {
      seen[name] = useTags()?.length;
      return null;
    };
    render(
      <>
        <Reader name="tag list" />
        <Reader name="entry list" />
      </>
    );

    await waitFor(() => expect(seen).toEqual({'tag list': 2, 'entry list': 2}));
    await vi.waitFor(() => expect(tagReads()).toBe(1));

    await act(() => seed([tag('3', {name: 'docker'})]));

    await waitFor(() => expect(seen).toEqual({'tag list': 3, 'entry list': 3}));
    await vi.waitFor(() => expect(tagReads()).toBe(2));
  });
});

describe('useTags, as readers come and go', () => {
  it('keeps reading for the readers left, and stops when none is', async () => {
    signIn();
    await seed([tag('1', {name: 'shell'})]);
    const queries = countQueries();
    const seen: Record<string, number | undefined> = {};
    const Reader = ({name}: {name: string}) => {
      seen[name] = useTags()?.length;
      return null;
    };
    const {rerender, unmount} = render(
      <>
        <Reader key="a" name="a" />
        <Reader key="b" name="b" />
      </>
    );
    await waitFor(() => expect(seen).toEqual({a: 1, b: 1}));

    // One reader goes: the other still sees every change.
    rerender(<Reader key="a" name="a" />);
    await act(() => seed([tag('2', {name: 'git'})]));
    await waitFor(() => expect(seen['a']).toBe(2));

    // The last goes: the query stops, and reads nothing on a change.
    unmount();
    const reads = queries('useTags');
    expect(reads).toBeGreaterThan(0);
    // A query of the tags of its own: once it reads the change, any other
    // query of them told of it has started.
    let counted = 0;
    const others = liveQuery(() =>
      syncSession(TEST_USER).db.tags.count()
    ).subscribe(count => {
      counted = count;
    });
    await act(() => seed([tag('3', {name: 'docker'})]));
    await waitFor(() => expect(counted).toBe(3));
    others.unsubscribe();
    expect(queries('useTags')).toBe(reads);

    // A new reader starts it afresh: unread, then the tags as they are now.
    const fresh: Array<number | undefined> = [];
    const Fresh = () => {
      fresh.push(useTags()?.length);
      return null;
    };
    render(<Fresh />);
    expect(fresh[0]).toBeUndefined();
    await waitFor(() => expect(fresh.at(-1)).toBe(3));
  });
});

describe('useEntries', () => {
  it('lists all the entries or the untagged, which alone read junctions', async () => {
    signIn();
    const untagging = junction('11', '1', '2');
    await seed([
      entry('1', {}),
      entry('2', {}),
      entry('3', {is_deleted: true}),
      junction('10', '1', '1'),
      {...untagging, attributes: {...untagging.attributes, is_deleted: true}},
    ]);
    const queries = countQueries();
    const seen: Record<string, string[] | undefined> = {};
    const Reader = ({which}: {which: 'all' | 'untagged'}) => {
      seen[which] = useEntries(which)?.entries.map(({id}) => id);
      return null;
    };
    render(
      <>
        <Reader which="all" />
        <Reader which="untagged" />
      </>
    );
    await waitFor(() =>
      expect(seen).toEqual({all: ['1', '2'], untagged: ['2']})
    );
    const all = queries('useEntries(all)');
    const untagged = queries('useEntries(untagged)');
    expect(all).toBeGreaterThan(0);

    // A tagging: the untagged are read again (by then, a query of all of
    // them told of it would have started too), all of them are not.
    await act(() => seed([junction('12', '1', '2')]));

    await waitFor(() => expect(seen['untagged']).toEqual([]));
    expect(queries('useEntries(untagged)')).toBeGreaterThan(untagged);
    expect(queries('useEntries(all)')).toBe(all);
    expect(seen['all']).toEqual(['1', '2']);
  });
});

describe('useTagNamed', () => {
  it("finds a new name's tag at once, in the tags read already", async () => {
    signIn();
    await seed([
      tag('1', {name: 'shell'}),
      tag('2', {name: 'git'}),
      tag('3', {name: 'old', is_deleted: true}),
    ]);
    const renders: Array<{
      asked: string;
      name?: string | undefined;
      id?: string | null;
    }> = [];
    const Probe = ({name}: {name: string}) => {
      const named = useTagNamed(name);
      renders.push({
        asked: name,
        ...(named === undefined
          ? {}
          : {name: named.name, id: named.tag?.id ?? null}),
      });
      return null;
    };
    const {rerender} = render(<Probe name="shell" />);
    await waitFor(() =>
      expect(renders.at(-1)).toEqual({asked: 'shell', name: 'shell', id: '1'})
    );

    rerender(<Probe name="git" />);

    // Among the tags read: its tag at once, in every render.
    const asked = (name: string) =>
      renders.filter(render => render.asked === name);
    expect(asked('git').length).toBeGreaterThan(0);
    expect(
      asked('git').every(({name, id}) => name === 'git' && id === '2')
    ).toBe(true);

    rerender(<Probe name="old" />);

    // Not among them (deleted): read from the database, the last answer
    // standing meanwhile, not an empty one.
    await waitFor(() =>
      expect(renders.at(-1)).toEqual({asked: 'old', name: 'old', id: null})
    );
    expect(
      asked('old').every(
        ({name, id}) => (name === 'git' && id === '2') || name === 'old'
      )
    ).toBe(true);
  });
});
