import {act, cleanup, fireEvent, screen, waitFor} from '@testing-library/react';
import {vi} from 'vitest';
import * as copying from '../../src/lib/data/copyEntry';
import * as identity from '../../src/lib/data/writeIdentity';
import * as writes from '../../src/lib/data/writes';
import {appMode} from '../../src/lib/shared';
import {syncSession} from '../../src/lib/sync/session';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {mockResult} from '../util/mockResult';
import {serveMockApi} from '../util/msw';
import {observeSyncWork} from '../util/observeSyncWork';
import {signIn, store, TEST_USER} from '../util/signIn';
import {renderAppAt} from '../util/TestAppRouter';

serveMockApi();
let finishWork: (expectedReuseFailures?: unknown[]) => Promise<void>;
beforeEach(() => {
  signIn();
  assignLoggedInCookie();

  const work = observeSyncWork(TEST_USER);
  const copied = vi.spyOn(copying, 'copyEntry');
  const captured = vi.spyOn(identity, 'captureWriteIdentity');
  const reused = vi.spyOn(writes, 'reuseEntry');
  const history = vi.spyOn(syncSession(TEST_USER).sync, 'entryReuses');
  let joinedReuses = 0;
  finishWork = async (expectedReuseFailures = []) => {
    await act(async () => {
      await Promise.all(
        copied.mock.results.map((_, i) => mockResult(copied, i))
      );
      // Failed clipboard writes can return before their identity capture.
      await Promise.all(
        captured.mock.results.map((_, i) => mockResult(captured, i))
      );
      const reuses = reused.mock.results
        .slice(joinedReuses)
        .map((_, i) => mockResult(reused, joinedReuses + i));
      joinedReuses = reused.mock.results.length;
      const results = await Promise.allSettled(reuses);
      expect(
        results.flatMap(result =>
          result.status === 'rejected' ? [result.reason] : []
        )
      ).toEqual(expectedReuseFailures);
    });
    await work.finish();
    // A persisted copy count can start a new history read, independently of sync.
    for (let i = 0; i < history.mock.results.length; i++) {
      await act(async () => {
        await mockResult(history, i);
      });
    }
    expect(work.syncAll).toHaveBeenCalledTimes(1);
  };
  Object.defineProperty(navigator, 'clipboard', {
    value: {writeText: vi.fn().mockResolvedValue(undefined)},
    configurable: true,
  });
});

const sources = ['body', 'keyboard', 'detail page'] as const;
// Keep handlers and the database until every operation the fixture started ends.
afterEach(async () => {
  cleanup();
  await finishWork();
});
type Source = (typeof sources)[number];

async function openSource(source: Source) {
  const view = await renderAppAt(
    source === 'detail page' ? '/test/entries/1' : '/test/test-tag-1',
    {act: true}
  );
  await screen.findByText('entry-1-body');
  if (source === 'detail page') {
    // The body precedes the history read. Finish that read before a short
    // failed-copy test can tear down its session.
    await screen.findByText('Not reused yet.');
  }
  if (source === 'keyboard') {
    act(() => {
      store.setAppMode(appMode.entriesList);
      store.setEntrySelectedID('1');
    });
  }
  return view;
}

function startCopy(source: Source) {
  if (source === 'keyboard') {
    fireEvent.keyDown(document, {key: 'Enter', code: 'Enter'});
  } else {
    fireEvent.click(
      source === 'body'
        ? screen.getByText('entry-1-body')
        : screen.getByRole('button', {name: 'Copy'})
    );
  }
}

function expectNotCopied(source: Source) {
  if (source === 'detail page') {
    expect(screen.getByRole('button', {name: 'Copy'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Copied'})).toBeNull();
  } else {
    expect(store.mostRecentCopyID).toBeNull();
  }
}

it.each(sources)(
  'does not report a failed %s copy as successful',
  async source => {
    const pending = Promise.withResolvers<void>();
    vi.spyOn(navigator.clipboard, 'writeText').mockReturnValueOnce(
      pending.promise
    );
    const failed = vi.spyOn(console, 'error');
    const reuse = vi.spyOn(writes, 'reuseEntry');
    await openSource(source);
    startCopy(source);

    // Release the controlled operation even if the pending-state assertion fails.
    try {
      expectNotCopied(source);
    } finally {
      await act(async () => {
        pending.reject(
          new DOMException('Clipboard permission denied', 'NotAllowedError')
        );
        await pending.promise.catch(() => undefined);
      });
    }
    expect(failed).toHaveBeenCalledExactlyOnceWith(
      'Failed to copy the entry:',
      expect.objectContaining({name: 'NotAllowedError'})
    );
    expectNotCopied(source);
    expect(reuse).not.toHaveBeenCalled();
  }
);

it.each(sources)(
  'reports a %s copy only after the clipboard accepts it',
  async source => {
    const pending = Promise.withResolvers<void>();
    vi.spyOn(navigator.clipboard, 'writeText').mockReturnValueOnce(
      pending.promise
    );
    await openSource(source);
    startCopy(source);
    try {
      expectNotCopied(source);
    } finally {
      await act(async () => {
        pending.resolve();
        await pending.promise;
      });
    }
    if (source === 'detail page') {
      expect(
        await screen.findByRole('button', {name: 'Copied'})
      ).toBeInTheDocument();
    } else {
      await waitFor(() => expect(store.mostRecentCopyID).toBe('1'));
    }
    await waitFor(async () =>
      expect(
        (await syncSession(TEST_USER).db.entries.get([TEST_USER, '1']))
          ?.attributes.reused_count
      ).toBe(1)
    );
  }
);

it('does not let an older body copy replace a newer keyboard copy', async () => {
  const copy = vi.spyOn(copying, 'copyEntry');
  const older = Promise.withResolvers<void>();
  const newer = Promise.withResolvers<void>();
  vi.spyOn(navigator.clipboard, 'writeText')
    .mockReturnValueOnce(older.promise)
    .mockReturnValueOnce(newer.promise);
  await openSource('body');
  startCopy('body');
  act(() => store.setEntrySelectedID('2'));
  startCopy('keyboard');
  expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(
    'entry-2-body'
  );
  await act(async () => {
    newer.resolve();
    await mockResult(copy, 1);
  });
  expect(store.mostRecentCopyID).toBe('2');
  await act(async () => {
    older.resolve();
    await mockResult(copy);
  });
  expect(store.mostRecentCopyID).toBe('2');
  await waitFor(async () => {
    const entries = await syncSession(TEST_USER).db.entries.bulkGet([
      [TEST_USER, '1'],
      [TEST_USER, '2'],
    ]);
    expect(entries.map(entry => entry?.attributes.reused_count)).toEqual([
      1, 1,
    ]);
  });
});

it('reports an older successful copy when the newer request fails', async () => {
  const older = Promise.withResolvers<void>();
  const newer = Promise.withResolvers<void>();
  vi.spyOn(navigator.clipboard, 'writeText')
    .mockReturnValueOnce(older.promise)
    .mockReturnValueOnce(newer.promise);
  const failed = vi.spyOn(console, 'error');
  await openSource('body');
  startCopy('body');
  act(() => store.setEntrySelectedID('2'));
  startCopy('keyboard');
  expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(
    'entry-2-body'
  );
  await act(async () => {
    newer.reject(
      new DOMException('Clipboard permission denied', 'NotAllowedError')
    );
    await newer.promise.catch(() => undefined);
    older.resolve();
    await older.promise;
  });
  expect(failed).toHaveBeenCalledExactlyOnceWith(
    'Failed to copy the entry:',
    expect.objectContaining({name: 'NotAllowedError'})
  );
  await waitFor(async () => {
    const entries = await syncSession(TEST_USER).db.entries.bulkGet([
      [TEST_USER, '1'],
      [TEST_USER, '2'],
    ]);
    expect(entries.map(entry => entry?.attributes.reused_count)).toEqual([
      1, 0,
    ]);
  });
  await waitFor(() => expect(store.mostRecentCopyID).toBe('1'));
});

it('still reports a successful copy when recording its reuse fails', async () => {
  const storageError = new Error('Storage unavailable');
  const reuse = vi
    .spyOn(writes, 'reuseEntry')
    .mockRejectedValueOnce(storageError);
  const failed = vi.spyOn(console, 'error');
  await openSource('body');
  await act(async () => startCopy('body'));
  await waitFor(() =>
    expect(failed).toHaveBeenCalledExactlyOnceWith(
      'Failed to count the entry copy:',
      expect.objectContaining({message: 'Storage unavailable'})
    )
  );
  await waitFor(() => expect(store.mostRecentCopyID).toBe('1'));
  expect(reuse).toHaveBeenCalledTimes(1);
  await finishWork([storageError]);
});

it.each(['body', 'keyboard'] as const)(
  'a late %s copy cannot replace feedback after its view unmounts',
  async source => {
    const copy = vi.spyOn(copying, 'copyEntry');
    const pending = Promise.withResolvers<void>();
    vi.spyOn(navigator.clipboard, 'writeText').mockReturnValueOnce(
      pending.promise
    );
    const reuse = vi.spyOn(writes, 'reuseEntry');
    const originalSession = syncSession(TEST_USER);
    const view = await openSource(source);
    startCopy(source);
    view.unmount();
    act(() => store.setMostRecentCopyID('replacement-copy'));

    await act(async () => {
      pending.resolve();
      await mockResult(copy);
    });

    expect(store.mostRecentCopyID).toBe('replacement-copy');
    expect(reuse).toHaveBeenCalledExactlyOnceWith(originalSession, '1', {
      accountId: '1',
      version: 1,
    });
    await waitFor(async () =>
      expect(
        (await originalSession.db.entries.get([TEST_USER, '1']))?.attributes
          .reused_count
      ).toBe(1)
    );
  }
);

it('a detail-page completion cannot mark a replacement entry as copied', async () => {
  const copy = vi.spyOn(copying, 'copyEntry');
  const historyReads = vi.spyOn(syncSession(TEST_USER).sync, 'entryReuses');
  const pending = Promise.withResolvers<void>();
  vi.spyOn(navigator.clipboard, 'writeText').mockReturnValueOnce(
    pending.promise
  );
  const reuse = vi.spyOn(writes, 'reuseEntry');
  const {history} = await openSource('detail page');

  startCopy('detail page');
  act(() => history.push('/test/entries/2'));
  await screen.findByText('entry-2-body');

  await act(async () => {
    pending.resolve();
    await mockResult(copy);
  });

  expectNotCopied('detail page');
  expect(reuse).toHaveBeenCalledExactlyOnceWith(syncSession(TEST_USER), '1', {
    accountId: '1',
    version: 1,
  });
  await waitFor(async () =>
    expect(
      (await syncSession(TEST_USER).db.entries.get([TEST_USER, '1']))
        ?.attributes.reused_count
    ).toBe(1)
  );
  await finishWork();
  expect(historyReads.mock.calls).toEqual([
    ['1', 1],
    ['2', 1],
  ]);
});
