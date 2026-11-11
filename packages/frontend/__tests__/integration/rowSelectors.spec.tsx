import {act, fireEvent, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import invariant from 'invariant';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {serveMockApi} from '../util/msw';
import {observeSyncWork} from '../util/observeSyncWork';
import {getRows, queryRows} from '../util/rows';
import {signIn, store, TEST_USER} from '../util/signIn';
import {renderAppAt} from '../util/TestAppRouter';

serveMockApi();
let work: ReturnType<typeof observeSyncWork>;
beforeEach(() => {
  signIn();
  assignLoggedInCookie();
  work = observeSyncWork(TEST_USER);
});
afterEach(async () => {
  await work.finish();
  expect(work.syncAll).toHaveBeenCalledTimes(1);
});

it.each([
  {kind: 'entry', id: 'tagsEntries-1'},
  {kind: 'tag', id: 'tag-1'},
])('identifies $kind rows without misusing ARIA roles', async ({kind, id}) => {
  const user = userEvent.setup();
  await renderAppAt('/test/test-tag-1', {act: true});
  await screen.findByText('entry-4-subject');
  const row = document.getElementById(id);
  invariant(row, 'the row is rendered');
  expect(row).toHaveAttribute('data-row-kind', kind);
  expect(row).not.toHaveAttribute('role');
  if (kind === 'tag') {
    expect(row).toHaveAttribute('data-testid', id);
    expect(within(row).getByTestId('tagLabelWrapper')).toHaveAttribute(
      'id',
      'tagLabelWrapper-1'
    );
  } else {
    expect(row.tagName).toBe('ARTICLE');
  }
  const container = within(row).getByTestId(`${kind}DragHandleContainer`);
  const handle = within(row).getByTestId(`${kind}DragHandle`);
  expect(container).not.toHaveAttribute('role');
  expect(handle).not.toHaveAttribute('role');
  for (const candidate of screen.getAllByTestId(`${kind}DragHandle`)) {
    expect(candidate).not.toBeVisible();
  }
  await user.hover(container);
  expect(handle).toBeVisible();
  for (const candidate of screen.getAllByTestId(`${kind}DragHandle`)) {
    if (candidate !== handle) expect(candidate).not.toBeVisible();
  }
  await user.unhover(container);
  expect(handle).not.toBeVisible();
  const invalidRoles = [
    'entry',
    'entryDragHandle',
    'entryDragHandleContainer',
    'tag',
    'tagDragHandle',
    'tagDragHandleContainer',
    'tagLabelWrapper',
  ];
  for (const role of invalidRoles) {
    expect(document.querySelectorAll(`[role="${role}"]`)).toHaveLength(0);
  }
});

it.each(['{Enter}', ' '])(
  'activates the tag button once with %s',
  async key => {
    const user = userEvent.setup();
    const {history} = await renderAppAt('/test/test-tag-1', {act: true});
    const button = await screen.findByTestId('tagListButton-2');
    const before = store.clickCount;
    await act(async () => button.focus());
    expect(button).toHaveFocus();
    await user.keyboard(key);
    expect(history.location.pathname).toBe('/test/test-tag-2');
    expect(store.clickCount).toBe(before + 1);
    expect(screen.getByTestId('tag-2')).toHaveAttribute('aria-current', 'true');
  }
);

it.each([
  {gesture: 'click', clicks: 1},
  {gesture: 'dblClick', clicks: 2},
] as const)(
  'does not duplicate tag selection on $gesture',
  async ({gesture, clicks}) => {
    const user = userEvent.setup();
    const {history} = await renderAppAt('/test/test-tag-1', {act: true});
    const label = await screen.findByText('test-tag-2');
    const before = store.clickCount;
    await user[gesture](label);
    expect(history.location.pathname).toBe('/test/test-tag-2');
    expect(store.clickCount).toBe(before + clicks);
    expect(screen.getByTestId('tag-2')).toHaveAttribute('aria-current', 'true');
  }
);

it.each([
  {kind: 'entry', id: 'tagsEntries-1', edit: 'Edit'},
  {kind: 'tag', id: 'tag-1', edit: 'Edit Tag'},
] as const)(
  'keeps the $kind context menu and hidden-row exclusion',
  async ({kind, id, edit}) => {
    const user = userEvent.setup();
    await renderAppAt('/test/test-tag-1', {act: true});
    await screen.findByText('entry-4-subject');
    const row = document.getElementById(id);
    invariant(row, 'the row is rendered');
    expect(getRows(kind)).toHaveLength(4);
    expect(fireEvent.contextMenu(row)).toBe(false);
    expect(await screen.findByRole('menuitem', {name: edit})).toBeVisible();
    expect(screen.getAllByRole('menu')).toHaveLength(1);
    // A modal menu keeps the rows mounted but hides them from accessibility.
    expect(document.querySelectorAll(`[data-row-kind="${kind}"]`)).toHaveLength(
      4
    );
    expect(queryRows(kind)).toHaveLength(0);
    expect(() => getRows(kind)).toThrow(`No accessible ${kind} rows found`);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(getRows(kind)).toHaveLength(4));
  }
);
