import {act, cleanup, fireEvent, screen, waitFor} from '@testing-library/react';
import {vi} from 'vitest';
import * as writes from '../../src/lib/data/writes';
import {appMode} from '../../src/lib/shared';
import {syncSession} from '../../src/lib/sync/session';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {serveMockApi} from '../util/msw';
import {signIn, store, TEST_USER} from '../util/signIn';
import {renderAppAt} from '../util/TestAppRouter';

serveMockApi();
beforeEach(() => {
  signIn();
  assignLoggedInCookie();
  Object.defineProperty(navigator, 'clipboard', {
    value: {writeText: vi.fn().mockResolvedValue(undefined)},
    configurable: true,
  });
});

const sources = ['body', 'keyboard', 'detail page'] as const;
// Unmount before the shared setup resets the account and deletes its data.
afterEach(() => cleanup());
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
    const failed = vi.spyOn(console, 'error').mockImplementation(() => {});
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
      expect(store.mostRecentCopyID).toBe('1');
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
    await newer.promise;
  });
  expect(store.mostRecentCopyID).toBe('2');
  await act(async () => {
    older.resolve();
    await older.promise;
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
  const failed = vi.spyOn(console, 'error').mockImplementation(() => {});
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
  expect(store.mostRecentCopyID).toBe('1');
});

it('still reports a successful copy when recording its reuse fails', async () => {
  vi.spyOn(writes, 'reuseEntry').mockRejectedValueOnce(
    new Error('Storage unavailable')
  );
  const failed = vi.spyOn(console, 'error').mockImplementation(() => {});
  await openSource('body');
  await act(async () => startCopy('body'));
  await waitFor(() =>
    expect(failed).toHaveBeenCalledExactlyOnceWith(
      'Failed to count the entry copy:',
      expect.objectContaining({message: 'Storage unavailable'})
    )
  );
  expect(store.mostRecentCopyID).toBe('1');
});

it.each(['body', 'keyboard'] as const)(
  'a late %s copy cannot replace feedback after its view unmounts',
  async source => {
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
      await pending.promise;
    });

    expect(store.mostRecentCopyID).toBe('replacement-copy');
    expect(reuse).toHaveBeenCalledExactlyOnceWith(originalSession, '1');
    await waitFor(async () =>
      expect(
        (await originalSession.db.entries.get([TEST_USER, '1']))?.attributes
          .reused_count
      ).toBe(1)
    );
  }
);

it('a detail-page completion cannot mark a replacement entry as copied', async () => {
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
    await pending.promise;
  });

  expectNotCopied('detail page');
  expect(reuse).toHaveBeenCalledExactlyOnceWith(syncSession(TEST_USER), '1');
  await waitFor(async () =>
    expect(
      (await syncSession(TEST_USER).db.entries.get([TEST_USER, '1']))
        ?.attributes.reused_count
    ).toBe(1)
  );
});
