import {act, cleanup, fireEvent, screen, waitFor} from '@testing-library/react';
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

afterEach(() => cleanup());

it.each(['Save', 'Cancel', 'Escape'])(
  'restores list navigation after closing a tag rename with %s',
  async close => {
    const {history} = await renderAppAt('/test/test-tag-1', {act: true});
    fireEvent.click(await screen.findByText('test-tag-1'));
    fireEvent.contextMenu(screen.getByText('test-tag-1'));
    fireEvent.click(await screen.findByRole('menuitem', {name: 'Edit Tag'}));
    fireEvent.change(byId('tagEditTagName1'), {target: {value: 'renamed tag'}});
    if (close === 'Escape') {
      fireEvent.keyDown(byId('tagEditTagName1'), {key: close, code: close});
    } else {
      fireEvent.click(byId(`tagEdit${close}1`));
    }
    await waitFor(() => expect(document.getElementById('tagEdit1')).toBeNull());
    await screen.findByText(close === 'Save' ? 'renamed tag' : 'test-tag-1');

    fireEvent.keyDown(document, {key: 'ArrowDown', code: 'ArrowDown'});
    expect(screen.getByTestId('tag-2')).toHaveAttribute('aria-current', 'true');
    fireEvent.keyDown(document, {key: 'Enter', code: 'Enter'});
    expect(history.location.pathname).toBe('/test/test-tag-2');
    // Enter handed the keyboard to entries; ArrowLeft hands it back.
    fireEvent.keyDown(document, {key: 'ArrowLeft', code: 'ArrowLeft'});
    fireEvent.keyDown(document, {key: 'ArrowUp', code: 'ArrowUp'});
    expect(screen.getByTestId('tag-1')).toHaveAttribute('aria-current', 'true');
    fireEvent.keyDown(document, {key: 'Enter', code: 'Enter'});
    expect(history.location.pathname).toBe(
      close === 'Save' ? '/test/renamed%20tag' : '/test/test-tag-1'
    );
  }
);

it.each(['tag', 'entry'])(
  'closing a tag rename does not take the keyboard from another %s editor',
  async kind => {
    await renderAppAt('/test/test-tag-1', {act: true});
    await screen.findByText('entry-1-subject');
    fireEvent.contextMenu(screen.getByText('test-tag-1'));
    fireEvent.click(await screen.findByRole('menuitem', {name: 'Edit Tag'}));
    fireEvent.contextMenu(
      screen.getByText(kind === 'tag' ? 'test-tag-2' : 'entry-1-subject')
    );
    fireEvent.click(
      await screen.findByRole('menuitem', {
        name: kind === 'tag' ? 'Edit Tag' : 'Edit',
      })
    );
    fireEvent.click(byId('tagEditCancel1'));
    const field = byId(
      kind === 'tag' ? 'tagEditTagName2' : 'textEntryEdit1Body'
    );
    act(() => field.focus());
    expect(
      fireEvent.keyDown(field, {key: 'ArrowLeft', code: 'ArrowLeft'})
    ).toBe(true);
    expect(field).toBeInTheDocument();
  }
);

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
