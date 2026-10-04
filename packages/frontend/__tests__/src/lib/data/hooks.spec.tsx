import {act, render, waitFor} from '@testing-library/react';
import {Dexie} from 'dexie';
import {describe, expect, it, vi} from 'vitest';

import {useSession, useTagNamed, useTags} from '../../../../src/lib/data/hooks';
import {
  clearMetrics,
  metricsSnapshot,
  NOTIFY_MS,
} from '../../../../src/lib/metrics/timings';
import {type SyncSession, syncSession} from '../../../../src/lib/sync/session';
import {signIn, TEST_USER} from '../../../util/signIn';
import {seed, tag} from '../../../util/storeFixtures';

/** How many times the tags were read from the database. */
const tagReads = () =>
  metricsSnapshot().timings.filter(({name}) => name === 'useTags').length;

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
    await Dexie.delete(first.db.name);

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
  /** The tag reads, once the HUD has been told of them all. */
  const settledReads = async () => {
    await new Promise(resolve => setTimeout(resolve, NOTIFY_MS + 150));
    return tagReads();
  };

  it('keeps reading for the readers left, and stops when none is', async () => {
    signIn();
    await seed([tag('1', {name: 'shell'})]);
    clearMetrics();
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
    const reads = await settledReads();
    await act(() => seed([tag('3', {name: 'docker'})]));
    expect(await settledReads()).toBe(reads);

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
