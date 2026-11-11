import {act, cleanup, fireEvent, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

type EditorKind = 'entry' | 'tag';

it.each<EditorKind>(['entry', 'tag'])(
  'types and tabs in the surviving %s after a real pointer closes the other editor',
  async kind => {
    const user = userEvent.setup();
    const copy = vi.spyOn(navigator.clipboard, 'writeText');
    const {history} = await renderAppAt('/test/test-tag-1', {act: true});
    await screen.findByText('entry-1-subject');
    const survivor = await openEditor(kind, 1);
    const other = await openEditor(kind === 'entry' ? 'tag' : 'entry', 1);
    await user.click(other.cancel);
    await user.click(survivor.field);
    await user.keyboard('{End}{Enter}next{ArrowLeft}X');
    expect(survivor.field).toHaveValue(
      kind === 'entry' ? 'entry-1-body\nnexXt' : 'test-tag-1nexXt'
    );
    await user.tab();
    expect(survivor.save).toHaveFocus();
    expect(history.location.pathname).toBe('/test/test-tag-1');
    expect(copy).not.toHaveBeenCalled();
  }
);

async function openEditor(kind: EditorKind, id: number) {
  fireEvent.contextMenu(
    screen.getByText(
      kind === 'entry' ? `entry-${id}-subject` : `test-tag-${id}`
    )
  );
  fireEvent.click(
    await screen.findByRole('menuitem', {
      name: kind === 'entry' ? 'Edit' : 'Edit Tag',
    })
  );
  return {
    field: byId(
      kind === 'entry' ? `textEntryEdit${id}Body` : `tagEditTagName${id}`
    ),
    cancel: byId(
      kind === 'entry' ? `textEntryEdit${id}Cancel` : `tagEditCancel${id}`
    ),
    save: byId(
      kind === 'entry' ? `textEntryEdit${id}Save` : `tagEditSave${id}`
    ),
  };
}

const overlaps: [EditorKind, EditorKind, 'first' | 'second'][] = [
  ['entry', 'tag', 'first'],
  ['entry', 'tag', 'second'],
  ['tag', 'entry', 'first'],
  ['tag', 'entry', 'second'],
  ['entry', 'entry', 'first'],
  ['entry', 'entry', 'second'],
  ['tag', 'tag', 'first'],
  ['tag', 'tag', 'second'],
];

it.each(overlaps)(
  'keeps editor gestures after opening %s then %s and closing %s',
  async (firstKind, secondKind, close) => {
    const {history} = await renderAppAt('/test/test-tag-1', {act: true});
    fireEvent.click(await screen.findByText('entry-1-body'));
    await act(async () => syncSession(TEST_USER).sync.flush());
    const copy = vi.spyOn(navigator.clipboard, 'writeText');
    copy.mockClear();
    const first = await openEditor(firstKind, 1);
    const second = await openEditor(
      secondKind,
      firstKind === secondKind ? 2 : 1
    );
    const closing = close === 'first' ? first : second;
    const survivor = close === 'first' ? second : first;
    const survivorKind = close === 'first' ? secondKind : firstKind;
    fireEvent.click(survivor.field);
    act(() => survivor.field.focus());
    fireEvent.click(closing.cancel);
    expect(closing.field).not.toBeInTheDocument();
    act(() => survivor.field.focus());

    expect(
      fireEvent.keyDown(survivor.field, {key: 'Enter', code: 'Enter'})
    ).toBe(true);
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) {
      expect(fireEvent.keyDown(survivor.field, {key, code: key})).toBe(true);
    }
    fireEvent.change(survivor.field, {target: {value: 'draft stays here'}});
    expect(survivor.field).toHaveValue('draft stays here');
    expect(history.location.pathname).toBe('/test/test-tag-1');
    expect(copy).not.toHaveBeenCalled();
    const tabAllowed = fireEvent.keyDown(survivor.field, {
      key: 'Tab',
      code: 'Tab',
    });
    if (survivorKind === 'entry') {
      expect(tabAllowed).toBe(false);
      expect(survivor.save).toHaveFocus();
    } else {
      // Renames keep native Tab; the new-tag form has the explicit field cycle.
      expect(tabAllowed).toBe(true);
    }
    fireEvent.click(survivor.cancel);
    if (survivorKind === 'entry') {
      fireEvent.keyDown(document, {key: 'ArrowDown', code: 'ArrowDown'});
      fireEvent.keyDown(document, {key: 'Enter', code: 'Enter'});
      await waitFor(() =>
        expect(copy).toHaveBeenCalledExactlyOnceWith('entry-2-body')
      );
    } else {
      fireEvent.keyDown(document, {key: 'ArrowDown', code: 'ArrowDown'});
      expect(screen.getByTestId('tag-2')).toHaveAttribute(
        'aria-current',
        'true'
      );
      fireEvent.keyDown(document, {key: 'Enter', code: 'Enter'});
      expect(history.location.pathname).toBe('/test/test-tag-2');
    }
  }
);

it.each([
  ['entry', 'file', 'textEntryNewTop'],
  ['tag', 'file', 'tagNewTop'],
  ['entry', 'row', 'textEntryNew-1-top'],
  ['tag', 'row', 'tagNewTop'],
  ['entry', 'list', 'textEntryNewBottom'],
  ['tag', 'list', 'tagNewBottom'],
])(
  'owns a new %s opened from the %s menu while an older editor remains',
  async (kind, source, id) => {
    await renderAppAt('/test/test-tag-1', {act: true});
    await screen.findByText('entry-1-subject');
    const older = await openEditor('tag', 2);
    act(() => older.field.focus());
    if (source === 'file') {
      fireEvent.click(byId('file-menu-button'));
    } else if (source === 'row') {
      fireEvent.contextMenu(
        screen.getByText(kind === 'entry' ? 'entry-1-subject' : 'test-tag-1')
      );
    } else {
      const target =
        kind === 'entry'
          ? byId('tagsEntriesList').lastElementChild
          : byId('tagList');
      invariant(target, 'list menu target exists');
      fireEvent.contextMenu(target);
    }
    fireEvent.click(
      await screen.findByRole('menuitem', {
        name: kind === 'entry' ? 'New Entry' : 'New Tag',
      })
    );
    const field = byId(`${id}${kind === 'entry' ? 'Subject' : 'TextField'}`);
    expect(field).toHaveFocus();
    expect(
      fireEvent.keyDown(field, {key: 'ArrowLeft', code: 'ArrowLeft'})
    ).toBe(true);
    fireEvent.keyDown(field, {key: 'Tab', code: 'Tab'});
    expect(byId(`${id}${kind === 'entry' ? 'Body' : 'Save'}`)).toHaveFocus();
    fireEvent.click(byId(`${id}Cancel`));
    act(() => older.field.focus());
    expect(fireEvent.keyDown(older.field, {key: 'Enter', code: 'Enter'})).toBe(
      true
    );
  }
);

it('lets list clicks and pane keys work with an editor still mounted, then resumes that editor on focus', async () => {
  const {history} = await renderAppAt('/test/test-tag-1', {act: true});
  fireEvent.click(await screen.findByText('entry-1-body'));
  await act(async () => syncSession(TEST_USER).sync.flush());
  const copy = vi.spyOn(navigator.clipboard, 'writeText');
  copy.mockClear();
  const editor = await openEditor('tag', 2);
  fireEvent.click(screen.getByText('test-tag-1'));
  fireEvent.keyDown(document, {key: 'Tab', code: 'Tab'});
  fireEvent.keyDown(document, {key: 'Enter', code: 'Enter'});
  await waitFor(() =>
    expect(copy).toHaveBeenCalledExactlyOnceWith('entry-1-body')
  );
  act(() => editor.field.focus());
  expect(
    fireEvent.keyDown(editor.field, {key: 'ArrowLeft', code: 'ArrowLeft'})
  ).toBe(true);
  expect(fireEvent.keyDown(editor.field, {key: 'Enter', code: 'Enter'})).toBe(
    true
  );
  expect(history.location.pathname).toBe('/test/test-tag-1');
  expect(copy).toHaveBeenCalledTimes(1);
});

it('cycles only the focused entry when an older editor is still open', async () => {
  await renderAppAt('/test/test-tag-1', {act: true});
  await screen.findByText('entry-1-subject');
  const first = await openEditor('entry', 1);
  const second = await openEditor('entry', 2);
  for (const editor of [first, second, first]) {
    fireEvent.click(editor.field);
    act(() => editor.field.focus());
    expect(fireEvent.keyDown(editor.field, {key: 'Tab', code: 'Tab'})).toBe(
      false
    );
    expect(editor.save).toHaveFocus();
  }
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

  expect(allowed).toBe(true);
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
