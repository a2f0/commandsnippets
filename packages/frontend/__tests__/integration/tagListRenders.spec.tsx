/**
 * How often the tag list renders, and its rows: once for each list read
 * (none for a copy of it an effect sets afterwards), with the tag selected
 * highlighted from the first.
 */
import {act, fireEvent, screen, waitFor} from '@testing-library/react';
import invariant from 'invariant';
import {HttpResponse, http} from 'msw/http';
import {vi} from 'vitest';
import {appMode} from '../../src/lib/shared';
import {syncSession} from '../../src/lib/sync/session';
import * as syncReads from '../../src/lib/sync/sync';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {mockResult} from '../util/mockResult';
import {API, serveMockApi, server} from '../util/msw';
import {getRows} from '../util/rows';
import {signIn, store, TEST_USER} from '../util/signIn';
import {seed, tag} from '../util/storeFixtures';
import {renderAppAt} from '../util/TestAppRouter';

const renders = vi.hoisted(() => ({lists: 0, rows: 0}));

/** Whether the hook calling this was called by a component in `file`. */
const calledIn = (file: string) =>
  (new Error().stack ?? '').split('\n')[3]?.includes(`/tags/${file}:`) ?? false;

// The list's and its rows' renders, every one: each calls this hook once a
// render.
vi.mock('../../src/lib/data/hooks', async importOriginal => {
  const actual =
    await importOriginal<typeof import('../../src/lib/data/hooks')>();
  return {
    ...actual,
    useReadOnly: () => {
      if (calledIn('TagList.tsx')) {
        renders.lists += 1;
      } else if (calledIn('Tag.tsx')) {
        renders.rows += 1;
      }
      return actual.useReadOnly();
    },
  };
});

const COUNT = 20;
const WAIT = {timeout: 10_000};
vi.setConfig({testTimeout: 30_000});

serveMockApi();
let finishOfflineWork: (tagIds: string[]) => Promise<void>;
let expectedTags: string[];
const unavailable = vi.fn(() => HttpResponse.error());
afterEach(async () => {
  await finishOfflineWork(expectedTags);
});
beforeEach(() => {
  signIn();
  assignLoggedInCookie();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn');
  vi.spyOn(console, 'error');
  unavailable.mockClear();
  expectedTags = ['3'];
  finishOfflineWork = observeOfflineWork();
});

/** Only this fixture's intentional network failures, never DB interruption. */
function observeOfflineWork() {
  const session = syncSession(TEST_USER);
  const engine = session.sync;
  const flush = vi.spyOn(engine, 'flush');
  const syncAll = vi.spyOn(engine, 'syncAll');
  const syncTag = vi.spyOn(engine, 'syncTag');
  const readiness = vi.spyOn(syncReads, 'isTagSynced');
  const operations = {flush, syncAll, syncTag, readiness};
  const joined = new Set<Promise<unknown>>();
  const failures: {operation: string; reason: unknown}[] = [];
  return async (tagIds: string[]) => {
    for (;;) {
      const pending: {operation: string; promise: Promise<unknown>}[] = [];
      for (const [operation, spy] of Object.entries(operations)) {
        for (let index = 0; index < spy.mock.results.length; index++) {
          const promise = mockResult<Promise<unknown>>(spy, index);
          if (joined.has(promise)) continue;
          joined.add(promise);
          pending.push({operation: `${operation}:${index}`, promise});
        }
      }
      if (pending.length === 0) break;
      await act(async () => {
        const results = await Promise.allSettled(pending.map(p => p.promise));
        for (const [index, result] of results.entries()) {
          if (result.status !== 'rejected') continue;
          const work = pending[index];
          invariant(work, 'the rejected offline operation was observed');
          failures.push({operation: work.operation, reason: result.reason});
        }
      });
    }
    expect(
      failures.toSorted((a, b) => a.operation.localeCompare(b.operation))
    ).toEqual(
      [
        'flush:0',
        'syncAll:0',
        ...tagIds.map((_, index) => `syncTag:${index}`),
      ].map(operation => ({
        operation,
        reason: expect.objectContaining({
          name: 'TypeError',
          message: 'fetch failed',
          cause: expect.objectContaining({type: 'error'}),
        }),
      }))
    );
    expect(flush).toHaveBeenCalledTimes(1);
    expect(syncAll).toHaveBeenCalledTimes(1);
    expect(syncTag.mock.calls).toEqual(tagIds.map(id => [id]));
    expect(readiness.mock.calls).toEqual(
      tagIds.map(id => [session.db, TEST_USER, id])
    );
    expect(unavailable).toHaveBeenCalledTimes(tagIds.length + 2);
    const warning = failures.filter(work => work.operation === 'flush:0');
    expect(console.warn).toHaveBeenCalledExactlyOnceWith(
      'WARNING: queued writes not sent yet:',
      warning[0]?.reason
    );
    const errors = failures.filter(work => work.operation !== 'flush:0');
    expect(console.error).toHaveBeenCalledTimes(errors.length);
    expect(vi.mocked(console.error).mock.calls).toEqual(
      expect.arrayContaining(
        errors.map(work => ['ERROR: sync failed:', work.reason])
      )
    );
  };
}

const highlighted = () =>
  getRows('tag')
    .filter(row => row.getAttribute('aria-current') === 'true')
    .map(row => row.id);

/** `COUNT` tags, as the database holds them, the third shown. */
async function showTags(): Promise<void> {
  await seed(
    Array.from({length: COUNT}, (_, i) =>
      tag(String(i + 1), {name: `name-${i + 1}`})
    )
  );
  // The list as the database holds it: no sync changes it meanwhile.
  server.use(http.all(`${API}/*`, unavailable));
  renders.lists = 0;
  renders.rows = 0;
  renderAppAt('/test/name-3');
  await screen.findByText(`name-${COUNT}`, undefined, WAIT);
  await finishOfflineWork(expectedTags);
}

it('renders the list once for each list read, and each row once', async () => {
  await showTags();
  // Before the tags are read, as they are, and once the tag shown is
  // selected; and each row once, and the two whose highlight that moves.
  expect(renders.lists).toBeLessThanOrEqual(3);
  expect(renders.rows).toBeLessThanOrEqual(COUNT + 2);
  expect(highlighted()).toEqual(['tag-3']);

  renders.lists = 0;
  renders.rows = 0;
  // A search: the list as read again, the tags whose names match.
  act(() => store.setTagSearchString('name-1'));
  expect(getRows('tag')).toHaveLength(11);
  expect(renders.lists).toBe(1);
  expect(renders.rows).toBeLessThanOrEqual(11);
  // The tag selected is not listed: the first is highlighted.
  expect(highlighted()).toEqual(['tag-1']);
});

it('highlights the tag chosen with the arrow keys until the tag selected changes', async () => {
  await showTags();
  await waitFor(() => expect(highlighted()).toEqual(['tag-3']), WAIT);
  act(() => store.setAppMode(appMode.tagsList));

  fireEvent.keyDown(document, {key: 'ArrowDown', code: 'ArrowDown'});
  expect(highlighted()).toEqual(['tag-4']);
  fireEvent.keyDown(document, {key: 'ArrowDown', code: 'ArrowDown'});
  fireEvent.keyDown(document, {key: 'ArrowUp', code: 'ArrowUp'});
  expect(highlighted()).toEqual(['tag-4']);

  // Another tag shown (Back, say): it is highlighted.
  act(() => store.setTagSelectedID('7'));
  expect(highlighted()).toEqual(['tag-7']);

  // A click on the tag shown highlights it again after the arrow keys.
  fireEvent.keyDown(document, {key: 'ArrowDown', code: 'ArrowDown'});
  expect(highlighted()).toEqual(['tag-8']);
  expectedTags = ['3', '7'];
  fireEvent.click(screen.getByText('name-7'));
  expect(highlighted()).toEqual(['tag-7']);
});
