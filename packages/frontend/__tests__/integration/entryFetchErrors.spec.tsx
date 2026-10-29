import {act, screen, waitFor} from '@testing-library/react';
import {HttpResponse, http} from 'msw/http';
import {type MockInstance, vi} from 'vitest';
import {apiClient} from '../../src/lib/api/apiClient';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {serveMockApi, server} from '../util/msw';
import {signIn, store} from '../util/signIn';
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
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  process.off('unhandledRejection', collectUnhandled);
  vi.restoreAllMocks();
});

/** Give Node time to report a rejection left unhandled. */
function settle() {
  return new Promise(resolve => setTimeout(resolve, 50));
}

const syncError = ['ERROR: sync failed:', expect.any(Error)];

describe('The entry lists', () => {
  it('search the entries the database holds, asking the API nothing', async () => {
    renderAppAt('/test?entries=all');
    await screen.findByText('entry-1-subject');
    const reads = vi.spyOn(apiClient, 'getEntriesAfter');

    act(() => {
      store.setEntrySearchString('entry-3');
    });

    await waitFor(() => expect(screen.getAllByRole('entry')).toHaveLength(1));
    // The search's match is highlighted: the subject spans elements.
    expect(screen.getByRole('entry')).toHaveTextContent('entry-3-subject');
    expect(reads).not.toHaveBeenCalled();
  });

  it.each([
    ['the all-entries list', '/test?entries=all'],
    ['the untagged list', '/test?entries=untagged'],
    ['a tag list', '/test/test-tag-1'],
  ])('log a sync that fails, for %s', async (_list, route) => {
    server.use(
      http.get('*/api/v1/entries', () =>
        HttpResponse.json({errors: []}, {status: 500})
      )
    );
    renderAppAt(route);

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(...syncError)
    );
    await settle();

    expect(unhandled).toEqual([]);
  });
});
