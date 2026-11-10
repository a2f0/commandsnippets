import {act, fireEvent, screen} from '@testing-library/react';
import invariant from 'invariant';
import {vi} from 'vitest';
import {syncSession} from '../../src/lib/sync/session';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {serveMockApi} from '../util/msw';
import {signIn, TEST_USER} from '../util/signIn';
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

function byId(id: string): HTMLElement {
  const element = document.getElementById(id);
  invariant(element, `#${id} is rendered`);
  return element;
}

it('leaves Enter in a row-created entry body to the editor', async () => {
  await renderAppAt('/test/test-tag-1', {act: true});
  fireEvent.click(await screen.findByText('entry-1-body'));
  await act(async () => syncSession(TEST_USER).sync.flush());
  const copy = vi.spyOn(navigator.clipboard, 'writeText');
  copy.mockClear();

  fireEvent.contextMenu(screen.getByText('entry-1-subject'));
  fireEvent.click(await screen.findByRole('menuitem', {name: 'New Entry'}));
  const body = byId('textEntryNew-1-topBody');
  fireEvent.click(body);
  act(() => body.focus());

  const allowed = fireEvent.keyDown(body, {key: 'Enter', code: 'Enter'});

  expect.soft(allowed).toBe(true);
  expect(copy).not.toHaveBeenCalled();
});

it('leaves arrow keys in a tag rename field to its caret', async () => {
  await renderAppAt('/test/test-tag-1', {act: true});
  fireEvent.click(await screen.findByText('test-tag-1'));
  fireEvent.contextMenu(screen.getByText('test-tag-1'));
  fireEvent.click(await screen.findByRole('menuitem', {name: 'Edit Tag'}));
  const name = byId('tagEditTagName1');
  act(() => name.focus());

  expect(fireEvent.keyDown(name, {key: 'ArrowLeft', code: 'ArrowLeft'})).toBe(
    true
  );
});
