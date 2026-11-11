import {act, screen, waitFor} from '@testing-library/react';
import {HttpResponse, http} from 'msw/http';
import {type MockInstance, vi} from 'vitest';
import {apiClient} from '../../src/lib/api/apiClient';
import {syncSession} from '../../src/lib/sync/session';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {mockResult} from '../util/mockResult';
import {serveMockApi, server} from '../util/msw';
import {observeSyncWork} from '../util/observeSyncWork';
import {getRows} from '../util/rows';
import {signIn, store, TEST_USER} from '../util/signIn';
import {renderAppAt} from '../util/TestAppRouter';

serveMockApi();
beforeEach(() => {
  signIn();
  assignLoggedInCookie();
});

// The rejections nothing handled while a test ran.
let unhandled: unknown[] = [];
const collectUnhandled = (reason: unknown) => {
  unhandled.push(reason);
};
let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  unhandled = [];
  process.on('unhandledRejection', collectUnhandled);
  consoleError = vi.spyOn(console, 'error');
});
afterEach(() => {
  process.off('unhandledRejection', collectUnhandled);
});

/**
 * Let Node report the rejections left unhandled so far, which it does once
 * the microtasks of a turn of the event loop have run: before the next turn.
 */
function settle() {
  return new Promise(resolve => {
    setImmediate(resolve);
  });
}

const syncError = [
  'ERROR: sync failed:',
  expect.objectContaining({
    name: 'ApiRequestError',
    status: 500,
    message: 'Failed to sync entries: Internal Server Error',
  }),
];

describe('The entry lists', () => {
  it('search the entries the database holds, asking the API nothing', async () => {
    const work = observeSyncWork(TEST_USER);
    renderAppAt('/test?entries=all');
    await screen.findByText('entry-1-subject');
    const reads = vi.spyOn(apiClient, 'getEntriesAfter');

    act(() => {
      store.setEntrySearchString('entry-3');
    });

    await waitFor(() => expect(getRows('entry')).toHaveLength(1));
    // The search's match is highlighted: the subject spans elements.
    expect(getRows('entry')[0]).toHaveTextContent('entry-3-subject');
    expect(reads).not.toHaveBeenCalled();
    await work.finish();
    expect(work.syncAll).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['the all-entries list', '/test?entries=all'],
    ['the untagged list', '/test?entries=untagged'],
    ['a tag list', '/test/test-tag-1'],
  ])('log a sync that fails, for %s', async (_list, route) => {
    const failedReads = vi.fn(() =>
      HttpResponse.json({errors: []}, {status: 500})
    );
    const warnings = vi.spyOn(console, 'warn');
    // Do not spy on or join the rejected collection promise: doing so would
    // handle it and invalidate this test's unhandled-rejection assertion.
    const tagSync = vi.spyOn(syncSession(TEST_USER).sync, 'syncTag');
    server.use(http.get('*/api/v1/entries', failedReads));
    renderAppAt(route);

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(...syncError)
    );
    if (route === '/test/test-tag-1') {
      // The failed collection leaves tag work queued; its independent successful
      // read must finish while this scenario's 500 handler still exists.
      await waitFor(() => expect(tagSync).toHaveBeenCalledExactlyOnceWith('1'));
      await act(async () => {
        await mockResult(tagSync);
      });
    } else {
      expect(tagSync).not.toHaveBeenCalled();
    }
    await settle();

    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(warnings).toHaveBeenCalledExactlyOnceWith(
      'WARNING: could not count entry pages:',
      expect.objectContaining({
        name: 'ApiRequestError',
        status: 500,
        message: 'Failed to count entries: Internal Server Error',
      })
    );
    expect(failedReads).toHaveBeenCalledTimes(2);
    expect(unhandled).toEqual([]);
  });
});
