import type {
  TextEntryReused,
  TextEntryReusedListDocument,
} from '@commandsnippets/api-shared/responses';
import {describe, expect, it} from 'vitest';
import {
  type HistoryPage,
  INITIAL_REUSE_HISTORY,
  mergeHistoryPage,
  type ReuseHistoryEvent,
  type ReuseHistoryState,
  type ReuseRead,
  transitionReuseHistory,
} from '../../../../src/components/entries/useReuseHistory';
import {pagination} from '../../../../src/msw/documents';
import {entry} from '../../../util/storeFixtures';

const URL = 'https://api.test/api/v1/entry_reuses';

function reuse(id: string, entryId: string): TextEntryReused {
  return {
    type: 'TextEntryReused',
    id,
    attributes: {date_created: '2026-01-01T00:00:00.000000'},
    relationships: {
      text_entry: {data: {type: 'TextEntry', id: entryId}},
      user: {data: {type: 'User', id: '1'}},
    },
  };
}

/** Page `page` of 2 of a history of 4 reuses. */
function document(
  page: number,
  data: TextEntryReused[],
  included: TextEntryReusedListDocument['included'] = []
): TextEntryReusedListDocument {
  return {data, included, ...pagination(URL, page, 2, 4)};
}

const first: HistoryPage = {
  reuses: [reuse('r4', '1'), reuse('r3', '2')],
  entries: [entry('1', {}), entry('2', {})],
  page: 1,
  total: 4,
  more: true,
};

describe('mergeHistoryPage', () => {
  it('starts the history afresh with page 1', () => {
    const merged = mergeHistoryPage(
      first,
      1,
      document(1, [reuse('r5', '1')], [entry('1', {})])
    );
    expect(merged.reuses.map(r => r.id)).toEqual(['r5']);
    expect(merged.entries.map(e => e.id)).toEqual(['1']);
    expect(merged).toMatchObject({page: 1, total: 4, more: true});
  });

  it('adds a later page once each, keeping the order read', () => {
    // A copy made meanwhile shifted the pages: r3 comes again.
    const merged = mergeHistoryPage(
      first,
      2,
      document(2, [reuse('r3', '2'), reuse('r2', '3')], [entry('3', {})])
    );
    expect(merged.reuses.map(r => r.id)).toEqual(['r4', 'r3', 'r2']);
    expect(merged.entries.map(e => e.id)).toEqual(['1', '2', '3']);
    expect(merged).toMatchObject({page: 2, more: false});
  });

  it('leaves out deleted entries', () => {
    const merged = mergeHistoryPage(
      null,
      1,
      document(1, [reuse('r1', '9')], [entry('9', {is_deleted: true})])
    );
    expect(merged.entries).toEqual([]);
  });

  it('has no more after an empty page', () => {
    expect(mergeHistoryPage(first, 2, document(1, [])).more).toBe(false);
  });
});

describe('transitionReuseHistory', () => {
  const page1 = document(
    1,
    [reuse('r4', '1'), reuse('r3', '2')],
    first.entries
  );
  const at = (read: ReuseRead, history: HistoryPage | null = null) => ({
    read,
    history,
    requests: 1,
  });
  const reading = (
    page: number,
    {current = true, refresh = false, request = 1} = {}
  ): ReuseRead => ({status: 'reading', page, request, current, refresh});
  const run = (events: ReuseHistoryEvent[], from = INITIAL_REUSE_HISTORY) =>
    events.reduce(transitionReuseHistory, from);

  it.each<[string, ReuseHistoryState, ReuseHistoryEvent, ReuseHistoryState]>([
    [
      'waiting reads a page',
      INITIAL_REUSE_HISTORY,
      {type: 'read', page: 1},
      at(reading(1)),
    ],
    [
      'read reads the next page',
      at({status: 'read'}, first),
      {type: 'read', page: 2},
      {read: reading(2, {request: 2}), history: first, requests: 2},
    ],
    [
      'failed retries its page',
      at({status: 'failed', page: 2}, first),
      {type: 'read', page: 2},
      {read: reading(2, {request: 2}), history: first, requests: 2},
    ],
    [
      'page 1 asked for during a read follows it',
      at(reading(2)),
      {type: 'read', page: 1},
      at(reading(2, {refresh: true})),
    ],
    [
      'another page asked for during a read is ignored',
      at(reading(1)),
      {type: 'read', page: 2},
      at(reading(1)),
    ],
    [
      'a current read succeeds',
      at(reading(1)),
      {type: 'succeed', request: 1, result: page1},
      at({status: 'read'}, mergeHistoryPage(null, 1, page1)),
    ],
    [
      'a read with nothing to read (read-only data) leaves the history',
      at(reading(1)),
      {type: 'succeed', request: 1, result: null},
      at({status: 'read'}),
    ],
    [
      'a current read fails at its page',
      at(reading(2), first),
      {type: 'fail', request: 1},
      at({status: 'failed', page: 2}, first),
    ],
    [
      'detaching drops the read in flight',
      at(reading(1)),
      {type: 'detach'},
      at(reading(1, {current: false})),
    ],
    [
      'a superseded read leaves the history and waits',
      at(reading(1, {current: false}), first),
      {type: 'succeed', request: 1, result: page1},
      at({status: 'waiting'}, first),
    ],
    [
      'a superseded failure is not shown',
      at(reading(1, {current: false})),
      {type: 'fail', request: 1},
      at({status: 'waiting'}),
    ],
    [
      'a queued refresh follows a success',
      at(reading(2, {refresh: true}), first),
      {type: 'succeed', request: 1, result: null},
      {read: reading(1, {request: 2}), history: first, requests: 2},
    ],
    [
      'a queued refresh follows a failure instead of showing it',
      at(reading(2, {refresh: true})),
      {type: 'fail', request: 1},
      {read: reading(1, {request: 2}), history: null, requests: 2},
    ],
    [
      'another request cannot finish the read',
      at(reading(1, {request: 2})),
      {type: 'succeed', request: 1, result: page1},
      at(reading(1, {request: 2})),
    ],
    [
      'a result with no read in flight is ignored',
      at({status: 'read'}, first),
      {type: 'fail', request: 1},
      at({status: 'read'}, first),
    ],
    [
      'detaching with no read in flight changes nothing',
      at({status: 'failed', page: 2}),
      {type: 'detach'},
      at({status: 'failed', page: 2}),
    ],
  ])('%s', (_name, state, event, next) => {
    expect(transitionReuseHistory(state, event)).toEqual(next);
  });

  it('returns the same state for an ignored event (no render)', () => {
    const state = at({status: 'read'}, first);
    expect(transitionReuseHistory(state, {type: 'detach'})).toBe(state);
    const refreshing = at(reading(1, {refresh: true}));
    expect(transitionReuseHistory(refreshing, {type: 'read', page: 1})).toBe(
      refreshing
    );
  });

  it('refreshes once after a changed count, dropping the stale page', () => {
    // read 1 -> count changes (detach, read 1 again) -> the first finishes.
    const next = run([
      {type: 'read', page: 1},
      {type: 'detach'},
      {type: 'read', page: 1},
      {type: 'succeed', request: 1, result: page1},
    ]);
    expect(next).toEqual({
      read: reading(1, {request: 2}),
      history: null,
      requests: 2,
    });
    expect(
      transitionReuseHistory(next, {type: 'succeed', request: 2, result: page1})
        .history
    ).toEqual(mergeHistoryPage(null, 1, page1));
  });

  it('keeps a remount (Strict Mode) loaded, not failed', () => {
    // mount, unmount, mount again, then the first read resolves.
    const next = run([
      {type: 'read', page: 1},
      {type: 'detach'},
      {type: 'read', page: 1},
      {type: 'succeed', request: 1, result: page1},
      {type: 'succeed', request: 2, result: page1},
    ]);
    expect(next.read).toEqual({status: 'read'});
    expect(next.history).toEqual(mergeHistoryPage(null, 1, page1));
  });

  it('never shows loading and failed together', () => {
    const states = [
      INITIAL_REUSE_HISTORY,
      run([{type: 'read', page: 1}]),
      run([
        {type: 'read', page: 1},
        {type: 'fail', request: 1},
      ]),
      run([
        {type: 'read', page: 1},
        {type: 'fail', request: 1},
        {type: 'read', page: 1},
      ]),
    ];
    expect(states.map(state => state.read.status)).toEqual([
      'waiting',
      'reading',
      'failed',
      'reading',
    ]);
  });
});
