import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {createMemoryHistory} from 'history';
import {beforeEach, describe, expect, it, type MockInstance, vi} from 'vitest';
import {apiClient} from '../../src/lib/api/apiClient';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {server} from '../util/msw';
import {signIn} from '../util/signIn';
import {TestAppRouter} from '../util/TestAppRouter';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
beforeEach(() => {
  signIn();
  assignLoggedInCookie();
});

/** Open `route` in the app. */
function renderAt(route: string) {
  const history = createMemoryHistory();
  history.push(route);
  render(<TestAppRouter history={history} />);
}

/** Open `subject`'s context menu. */
async function openContextMenu(subject: string) {
  fireEvent.contextMenu(await screen.findByText(subject, {}, {timeout: 3000}));
}

describe('Delete Untagged Entry', () => {
  let deleteEntrySpy: MockInstance;
  let untagEntrySpy: MockInstance;

  beforeEach(async () => {
    // The mock API's fixtures are all in tag 1: one in no tag.
    await apiClient.createEntry('untagged-subject', 'untagged body');
    deleteEntrySpy = vi.spyOn(apiClient, 'deleteEntry');
    untagEntrySpy = vi.spyOn(apiClient, 'untagEntry');
  });

  afterEach(() => {
    deleteEntrySpy.mockRestore();
    untagEntrySpy.mockRestore();
  });

  it('deletes an entry from the untagged entries', async () => {
    renderAt('/test?entries=untagged');
    await openContextMenu('untagged-subject');
    fireEvent.click(await screen.findByRole('menuitem', {name: 'Delete'}));

    await waitFor(() => {
      expect(screen.queryByText('untagged-subject')).not.toBeInTheDocument();
    });
    expect(deleteEntrySpy).toHaveBeenCalledTimes(1);
    expect(untagEntrySpy).not.toHaveBeenCalled();
  });

  it("takes an entry out of a tag's entries", async () => {
    renderAt('/test/test-tag-1');
    await openContextMenu('entry-1-subject');
    fireEvent.click(await screen.findByRole('menuitem', {name: 'Untag'}));

    await waitFor(() => {
      expect(screen.queryByText('entry-1-subject')).not.toBeInTheDocument();
    });
    // Sent from the queue, naming when it was made.
    await waitFor(() =>
      expect(untagEntrySpy).toHaveBeenCalledWith('1', expect.any(String))
    );
    expect(deleteEntrySpy).not.toHaveBeenCalled();
    expect(screen.getByText('entry-2-subject')).toBeInTheDocument();
  });

  it('offers Delete, not Untag, for an untagged entry', async () => {
    renderAt('/test?entries=untagged');
    await openContextMenu('untagged-subject');

    expect(
      await screen.findByRole('menuitem', {name: 'Delete'})
    ).toBeInTheDocument();
    expect(screen.queryByText('Untag')).not.toBeInTheDocument();
  });

  it("offers Untag, not Delete, for a tag's entry", async () => {
    renderAt('/test/test-tag-1');
    await openContextMenu('entry-1-subject');

    expect(
      await screen.findByRole('menuitem', {name: 'Untag'})
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', {name: 'Delete'})
    ).not.toBeInTheDocument();
  });
});
