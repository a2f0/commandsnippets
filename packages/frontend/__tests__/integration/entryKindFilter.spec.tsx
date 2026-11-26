/**
 * View > All Entry Types, Keyboard Shortcuts or Text Entries: the entry
 * lists show only that kind, the tags count and sort by it, a new entry
 * starts as it, and the choice is saved.
 */
import {act, fireEvent, screen, waitFor} from '@testing-library/react';
import invariant from 'invariant';
import {apiClient} from '../../src/lib/api/apiClient';
import {STORAGE_KEY} from '../../src/lib/state/appState';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {serveMockApi} from '../util/msw';
import {observeSyncWork} from '../util/observeSyncWork';
import {getRows} from '../util/rows';
import {signIn, store, TEST_USER} from '../util/signIn';
import {renderAppAt} from '../util/TestAppRouter';

serveMockApi();
let syncWork: ReturnType<typeof observeSyncWork>;
afterEach(async () => {
  await syncWork.finish();
});
beforeEach(async () => {
  signIn();
  syncWork = observeSyncWork(TEST_USER);
  assignLoggedInCookie();
  // test-tag-1 holds entries 1 to 4, entry 1 a shortcut; test-tag-2 two
  // shortcuts of its own.
  const api = apiClient.forVersion(1);
  await api.updateEntry('1', {
    subject: 'entry-1-subject',
    body: 'ctrl + b, c',
    kind: 'shortcut',
  });
  for (const subject of ['keys-a', 'keys-b']) {
    const made = await api.createEntry({
      subject,
      body: 'cmd + k',
      kind: 'shortcut',
    });
    await api.tagEntry('2', made.data.id);
  }
});

/** Choose `item` from the View menu. */
async function chooseView(item: string): Promise<void> {
  const view = await screen.findByRole('menu', {name: 'View'});
  await act(async () => {
    fireEvent.click(view);
  });
  const choice = await screen.findByText(item);
  await act(async () => {
    fireEvent.click(choice);
  });
}

/** The tags listed, in order, each with the count it shows. */
const tagLabels = () =>
  getRows('tag').map(row =>
    (row.querySelector('[data-testid="tagLabelWrapper"]')?.textContent ?? '')
      .replace(/\s+/g, ' ')
      .trim()
  );

it('lists and counts only the kind chosen, and sorts the tags by its counts', async () => {
  act(() => {
    store.setShowTagCounts(true);
    store.setTagSortOrder('-entry_count');
  });
  renderAppAt('/test/test-tag-1');
  await screen.findByText('entry-2-subject');

  await chooseView('Keyboard Shortcuts');

  await waitFor(() =>
    expect(screen.queryByText('entry-2-subject')).not.toBeInTheDocument()
  );
  expect(screen.getByText('entry-1-subject')).toBeInTheDocument();
  await waitFor(() =>
    expect(tagLabels().slice(0, 2)).toEqual([
      'test-tag-2 (2)',
      'test-tag-1 (1)',
    ])
  );

  await chooseView('Text Entries');

  await screen.findByText('entry-2-subject');
  expect(screen.queryByText('entry-1-subject')).not.toBeInTheDocument();
  await waitFor(() =>
    expect(tagLabels().slice(0, 2)).toEqual([
      'test-tag-1 (3)',
      'test-tag-2 (0)',
    ])
  );

  await chooseView('All Entry Types');

  await screen.findByText('entry-1-subject');
  expect(screen.getByText('entry-2-subject')).toBeInTheDocument();
});

it('says a list holds none of the kind, and saves the choice', async () => {
  renderAppAt('/test/test-tag-2');
  await screen.findByText('keys-a');

  await chooseView('Text Entries');

  expect(
    await screen.findByText(
      'No text entries here. View > All Entry Types shows every entry.'
    )
  ).toBeInTheDocument();
  expect(screen.queryByText('keys-a')).not.toBeInTheDocument();
  const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  invariant(
    typeof saved === 'object' && saved !== null && 'state' in saved,
    'the app state is saved'
  );
  expect(saved.state).toMatchObject({entryKindFilter: 'snippet'});
});

it('starts a new entry as a shortcut while only shortcuts show', async () => {
  act(() => store.setEntryKindFilter('shortcut'));
  renderAppAt('/test/test-tag-1');
  await screen.findByText('entry-1-subject');

  act(() => store.setEntryNew('textEntry-top'));

  expect(
    await screen.findByRole('checkbox', {name: 'Keyboard shortcut'})
  ).toBeChecked();
});
