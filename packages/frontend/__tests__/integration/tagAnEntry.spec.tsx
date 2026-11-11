import {act, isInaccessible, screen, waitFor} from '@testing-library/react';
import userEvent, {type UserEvent} from '@testing-library/user-event';
import {vi} from 'vitest';
import * as writes from '../../src/lib/data/writes';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {
  dragEnter,
  dragStart,
  drop,
  expectRows,
  pointAtHandle,
  rowAt,
} from '../util/dragReorder';
import {mockResult} from '../util/mockResult';
import {serveMockApi} from '../util/msw';
import {observeSyncWork} from '../util/observeSyncWork';
import {getRows, queryRows} from '../util/rows';
import {signIn, TEST_USER} from '../util/signIn';
import {renderAppAt} from '../util/TestAppRouter';

// The mock API tags entry 1 with test-tag-2 as the API would.
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

/** Open tag `index` (of the four) by a click on its label. */
async function openTag(user: UserEvent, index: number) {
  const labels = screen
    .getAllByTestId('tagLabelWrapper')
    .filter(label => !isInaccessible(label));
  expect(labels).toHaveLength(4);
  await user.pointer({target: rowAt(labels, index), keys: '[MouseLeft]'});
}

describe('Tag An Entry', () => {
  it('tags an entry dropped on a tag', async () => {
    const tagged = vi.spyOn(writes, 'tagEntry');
    const user = userEvent.setup();
    const {history} = renderAppAt('/test/test-tag-1');
    await screen.findByText('entry-4-subject');
    const entries = expectRows(
      'entry',
      [1, 2, 3, 4].map(n => `entry-${n}-subject`)
    );
    entries.forEach((entry, index) => {
      expect(entry).toHaveTextContent(`entry-${index + 1}-body`);
    });

    // Tag 2 holds none of them yet.
    await openTag(user, 1);
    expect(history.location.pathname).toBe('/test/test-tag-2');
    await waitFor(() => expect(queryRows('entry')).toHaveLength(0));
    await openTag(user, 0);
    expect(history.location.pathname).toBe('/test/test-tag-1');
    await waitFor(() => expect(queryRows('entry')).toHaveLength(4));

    const handle = await pointAtHandle(user, 'entry', 0, 4);
    const tags = getRows('tag');
    expect(tags).toHaveLength(4);
    await dragStart(handle);
    await dragEnter(rowAt(tags, 1));
    await drop(rowAt(tags, 1));

    await openTag(user, 1);
    expect(history.location.pathname).toBe('/test/test-tag-2');
    await waitFor(() => expect(queryRows('entry')).toHaveLength(1));
    expectRows('entry', ['entry-1-subject']);
    expect(tagged).toHaveBeenCalledTimes(1);
    await act(async () => {
      await mockResult(tagged);
    });
  });
});
