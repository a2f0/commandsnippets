/**
 * Keyboard shortcut entries: drawn as keys, with nothing to copy (no copy
 * icon, no Copy in their menu or on their page; a click or Enter only
 * selects), and made from any entry's editor.
 */
import {act, fireEvent, screen, waitFor, within} from '@testing-library/react';
import invariant from 'invariant';
import {vi} from 'vitest';
import {apiClient} from '../../src/lib/api/apiClient';
import * as copying from '../../src/lib/data/copyEntry';
import {appMode} from '../../src/lib/shared';
import {apiClientMethods} from '../util/apiClientMethods';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {serveMockApi} from '../util/msw';
import {observeSyncWork} from '../util/observeSyncWork';
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
  Object.defineProperty(navigator, 'clipboard', {
    value: {writeText: vi.fn().mockResolvedValue(undefined)},
    configurable: true,
  });
  // Entry 1, in tag 1, is a shortcut.
  await apiClient.forVersion(1).updateEntry('1', {
    subject: 'entry-1-subject',
    body: 'cntrl + b, c',
    kind: 'shortcut',
  });
});

/** The row of the entry with this subject. */
async function rowOf(subject: string) {
  const row = (await screen.findByText(subject)).closest(
    '[data-row-kind="entry"]'
  );
  invariant(row instanceof HTMLElement, `${subject} is in a row`);
  return row;
}

/** The labels of the keys drawn in `element`. */
const keysIn = (element: HTMLElement) =>
  [...element.querySelectorAll('kbd kbd')].map(key => key.textContent);

it('draws a shortcut as keys, and a click or Enter selects it, copying nothing', async () => {
  const copy = vi.spyOn(copying, 'copyEntry');
  renderAppAt('/test/test-tag-1');
  const row = await rowOf('entry-1-subject');
  await waitFor(() => expect(keysIn(row)).toEqual(['Ctrl', 'B', 'c']));
  // A snippet beside it is its text, with its copy icon.
  expect(keysIn(await rowOf('entry-2-subject'))).toEqual([]);

  fireEvent.click(within(row).getByText('Ctrl'));
  expect(store.entrySelectedID).toBe('1');
  expect(store.appMode).toBe(appMode.entriesList);
  fireEvent.keyDown(document, {key: 'Enter', code: 'Enter'});

  expect(copy).not.toHaveBeenCalled();
  expect(store.mostRecentCopyID).toBeNull();
  expect(row.querySelector('[data-testid="FileCopySharpIcon"]')).toBeNull();
});

it("offers no Copy in a shortcut's menu", async () => {
  renderAppAt('/test/test-tag-1');

  fireEvent.contextMenu(await rowOf('entry-1-subject'));

  expect(
    await screen.findByRole('menuitem', {name: 'Edit'})
  ).toBeInTheDocument();
  expect(screen.queryByRole('menuitem', {name: 'Copy'})).toBeNull();
});

it("shows a shortcut's keys on its page, with no Copy", async () => {
  renderAppAt('/test/entries/1');

  const keys = await screen.findByLabelText('Keys');
  await waitFor(() => expect(keysIn(keys)).toEqual(['Ctrl', 'B', 'c']));
  expect(screen.queryByRole('button', {name: 'Copy'})).toBeNull();
  await screen.findByText('Not reused yet.');
});

it('makes an entry a shortcut from its editor, which the API stores', async () => {
  const update = vi.spyOn(apiClientMethods, 'updateEntry');
  renderAppAt('/test/test-tag-1');
  fireEvent.contextMenu(await screen.findByText('entry-2-subject'));
  fireEvent.click(await screen.findByRole('menuitem', {name: 'Edit'}));
  const shortcut = await screen.findByRole('checkbox', {
    name: 'Keyboard shortcut',
  });
  fireEvent.click(shortcut);
  fireEvent.change(await screen.findByPlaceholderText('keys: ctrl + b, c'), {
    target: {value: 'cmd + d'},
  });

  await act(async () => fireEvent.click(screen.getByText('Save')));

  const row = await rowOf('entry-2-subject');
  await waitFor(() => expect(keysIn(row)).toEqual(['Cmd', 'D']));
  await waitFor(() =>
    expect(update).toHaveBeenCalledWith(
      '2',
      {subject: 'entry-2-subject', body: 'cmd + d', kind: 'shortcut'},
      expect.any(String)
    )
  );
});
