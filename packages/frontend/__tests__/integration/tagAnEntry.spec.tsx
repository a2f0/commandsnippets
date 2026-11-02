import {screen, waitFor} from '@testing-library/react';
import userEvent, {type UserEvent} from '@testing-library/user-event';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {
  dragEnter,
  dragStart,
  drop,
  expectRows,
  pointAtHandle,
  rowAt,
} from '../util/dragReorder';
import {serveMockApi} from '../util/msw';
import {signIn} from '../util/signIn';
import {renderAppAt} from '../util/TestAppRouter';

// The mock API tags entry 1 with test-tag-2 as the API would.
serveMockApi();
beforeEach(() => {
  signIn();
  assignLoggedInCookie();
});

/** Open tag `index` (of the four) by a click on its label. */
async function openTag(user: UserEvent, index: number) {
  const labels = screen.getAllByRole('tagLabelWrapper');
  expect(labels).toHaveLength(4);
  await user.pointer({target: rowAt(labels, index), keys: '[MouseLeft]'});
}

describe('Tag An Entry', () => {
  it('tags an entry dropped on a tag', async () => {
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
    await waitFor(() => expect(screen.queryAllByRole('entry')).toHaveLength(0));
    await openTag(user, 0);
    expect(history.location.pathname).toBe('/test/test-tag-1');
    await waitFor(() => expect(screen.queryAllByRole('entry')).toHaveLength(4));

    const handle = await pointAtHandle(user, 'entry', 0, 4);
    const tags = screen.getAllByRole('tag');
    expect(tags).toHaveLength(4);
    await dragStart(handle);
    await dragEnter(rowAt(tags, 1));
    await drop(rowAt(tags, 1));

    await openTag(user, 1);
    expect(history.location.pathname).toBe('/test/test-tag-2');
    await waitFor(() => expect(screen.queryAllByRole('entry')).toHaveLength(1));
    expectRows('entry', ['entry-1-subject']);
  });
});
