import {act, fireEvent, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, type MockInstance, vi} from 'vitest';
import {apiClient} from '../../src/lib/api/apiClient';
import * as writes from '../../src/lib/data/writes';
import {apiClientMethods} from '../util/apiClientMethods';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {mockResult} from '../util/mockResult';
import {serveMockApi} from '../util/msw';
import {observeSyncWork} from '../util/observeSyncWork';
import {signIn, TEST_USER} from '../util/signIn';
import {renderAppAt} from '../util/TestAppRouter';

serveMockApi();
let syncWork: ReturnType<typeof observeSyncWork>;
// Finish the mounted fixture before MSW removes its handlers and DB reset.
afterEach(async () => {
  await syncWork.finish();
  expect(syncWork.syncAll).toHaveBeenCalledTimes(1);
});
beforeEach(() => {
  signIn();
  syncWork = observeSyncWork(TEST_USER);
  assignLoggedInCookie();
});

/** Open `subject`'s context menu. */
async function openContextMenu(subject: string) {
  fireEvent.contextMenu(await screen.findByText(subject));
}

describe('Delete Untagged Entry', () => {
  let deleteEntrySpy: MockInstance;
  let untagEntrySpy: MockInstance;

  beforeEach(async () => {
    // The mock API's fixtures are all in tag 1: one in no tag.
    await apiClient
      .forVersion(1)
      .createEntry('untagged-subject', 'untagged body');
    deleteEntrySpy = vi.spyOn(apiClientMethods, 'deleteEntry');
    untagEntrySpy = vi.spyOn(apiClientMethods, 'untagEntry');
  });

  it('deletes an entry from the untagged entries', async () => {
    const deleted = vi.spyOn(writes, 'deleteEntry');
    renderAppAt('/test?entries=untagged');
    await openContextMenu('untagged-subject');
    fireEvent.click(await screen.findByRole('menuitem', {name: 'Delete'}));

    await waitFor(() => {
      expect(screen.queryByText('untagged-subject')).not.toBeInTheDocument();
    });
    expect(deleted).toHaveBeenCalledTimes(1);
    await act(async () => {
      await mockResult(deleted);
    });
    expect(deleteEntrySpy).toHaveBeenCalledTimes(1);
    expect(untagEntrySpy).not.toHaveBeenCalled();
  });

  it("takes an entry out of a tag's entries", async () => {
    const untagged = vi.spyOn(writes, 'untagEntry');
    renderAppAt('/test/test-tag-1');
    await openContextMenu('entry-1-subject');
    fireEvent.click(await screen.findByRole('menuitem', {name: 'Untag'}));

    await waitFor(() => {
      expect(screen.queryByText('entry-1-subject')).not.toBeInTheDocument();
    });
    expect(untagged).toHaveBeenCalledTimes(1);
    await act(async () => {
      await mockResult(untagged);
    });
    // Sent from the queue, naming when it was made.
    await waitFor(() =>
      expect(untagEntrySpy).toHaveBeenCalledWith('1', expect.any(String))
    );
    expect(deleteEntrySpy).not.toHaveBeenCalled();
    expect(screen.getByText('entry-2-subject')).toBeInTheDocument();
  });

  it('offers Delete, not Untag, for an untagged entry', async () => {
    renderAppAt('/test?entries=untagged');
    await openContextMenu('untagged-subject');

    expect(
      await screen.findByRole('menuitem', {name: 'Delete'})
    ).toBeInTheDocument();
    expect(screen.queryByText('Untag')).not.toBeInTheDocument();
  });

  it("offers Untag, not Delete, for a tag's entry", async () => {
    renderAppAt('/test/test-tag-1');
    await openContextMenu('entry-1-subject');

    expect(
      await screen.findByRole('menuitem', {name: 'Untag'})
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', {name: 'Delete'})
    ).not.toBeInTheDocument();
  });
});
