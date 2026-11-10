import {act, cleanup, fireEvent, screen, waitFor} from '@testing-library/react';
import invariant from 'invariant';
import {vi} from 'vitest';
import * as tagRename from '../../src/lib/data/tagRename';
import * as writes from '../../src/lib/data/writes';
import {useAppState} from '../../src/lib/state/appState';
import {
  claimData,
  endSyncSession,
  syncSession,
} from '../../src/lib/sync/session';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {serveMockApi} from '../util/msw';
import {signIn, TEST_USER} from '../util/signIn';
import {renderAppAt} from '../util/TestAppRouter';

serveMockApi();
beforeEach(() => {
  signIn();
  assignLoggedInCookie();
});

afterEach(() => cleanup());

const editors = [
  {
    kind: 'createEntry',
    label: 'entry-1-subject',
    menu: 'New Entry',
    field: 'textEntryNew-1-topSubject',
    save: 'textEntryNew-1-topSave',
    cancel: 'textEntryNew-1-topCancel',
  },
  {
    kind: 'updateEntry',
    label: 'entry-1-subject',
    menu: 'Edit',
    field: 'textEntryEdit1Subject',
    save: 'textEntryEdit1Save',
    cancel: 'textEntryEdit1Cancel',
  },
  {
    kind: 'createTag',
    label: 'test-tag-2',
    menu: 'New Tag',
    field: 'tagNewTopTextField',
    save: 'tagNewTopSave',
    cancel: 'tagNewTopCancel',
  },
  {
    kind: 'renameTag',
    label: 'test-tag-2',
    menu: 'Edit Tag',
    field: 'tagEditTagName2',
    save: 'tagEditSave2',
    cancel: 'tagEditCancel2',
  },
] as const;
interface Editor {
  kind: (typeof editors)[number]['kind'];
  label: string;
  menu: string;
  field: string;
  save: string;
  cancel: string;
}

const selectedTagEditor: Editor = {
  kind: 'renameTag',
  label: 'test-tag-1',
  menu: 'Edit Tag',
  field: 'tagEditTagName1',
  save: 'tagEditSave1',
  cancel: 'tagEditCancel1',
};

function byId(id: string): HTMLElement {
  const element = document.getElementById(id);
  invariant(element, `#${id} is rendered`);
  return element;
}

async function openEditor(editor: Editor) {
  fireEvent.contextMenu(screen.getByText(editor.label));
  fireEvent.click(await screen.findByRole('menuitem', {name: editor.menu}));
  if (editor.kind === 'createEntry') {
    fireEvent.change(byId('textEntryNew-1-topBody'), {target: {value: 'body'}});
  }
  return byId(editor.field);
}

/** Pause the real local write, not its persistence or the editor's callback. */
function pauseWrite(kind: Editor['kind'], when: 'before' | 'after' = 'before') {
  const followUp = vi.spyOn(tagRename, 'isCurrentTagRename');
  const entered = Promise.withResolvers<void>();
  const resume = Promise.withResolvers<void>();
  let result: Promise<unknown> | undefined;
  const hold =
    <Args extends unknown[], Result>(
      write: (...args: Args) => Promise<Result>
    ) =>
    (...args: Args): Promise<Result> => {
      const pending = (async () => {
        if (when === 'before') {
          entered.resolve();
          await resume.promise;
          return write(...args);
        }
        const written = await write(...args);
        entered.resolve();
        await resume.promise;
        return written;
      })();
      result = pending;
      return pending;
    };
  const original = {...writes};
  switch (kind) {
    case 'createEntry':
      vi.spyOn(writes, kind).mockImplementationOnce(hold(original.createEntry));
      break;
    case 'updateEntry':
      vi.spyOn(writes, kind).mockImplementationOnce(hold(original.updateEntry));
      break;
    case 'createTag':
      vi.spyOn(writes, kind).mockImplementationOnce(hold(original.createTag));
      break;
    case 'renameTag':
      vi.spyOn(writes, kind).mockImplementationOnce(hold(original.renameTag));
      break;
  }
  return {
    entered: entered.promise,
    finish: () =>
      act(async () => {
        resume.resolve();
        await result;
        // The persisted-rename check reads IndexedDB after the write resolves.
        // Await that real read too, so absence-of-navigation assertions are final.
        await Promise.all(followUp.mock.results.map(read => read.value));
      }),
  };
}

async function stored(kind: Editor['kind'], value: string) {
  const {db} = syncSession(TEST_USER);
  if (kind === 'createEntry' || kind === 'updateEntry') {
    return db.entries.filter(row => row.attributes.subject === value).count();
  }
  return db.tags.filter(row => row.attributes.name === value).count();
}

it.each(editors)(
  '$kind completion leaves a cancelled-and-reopened editor intact',
  async editor => {
    const {history} = await renderAppAt('/test/test-tag-1', {act: true});
    await screen.findByText('entry-1-subject');
    const pending = pauseWrite(editor.kind);
    try {
      fireEvent.change(await openEditor(editor), {
        target: {value: 'saved draft'},
      });
      fireEvent.click(byId(editor.save));
      await pending.entered;
      fireEvent.click(byId(editor.cancel));
      expect(document.getElementById(editor.field)).toBeNull();
      fireEvent.change(await openEditor(editor), {
        target: {value: 'new draft'},
      });

      await pending.finish();

      expect(await stored(editor.kind, 'saved draft')).toBe(1);
      expect(byId(editor.field)).toHaveValue('new draft');
      expect(history.location.pathname).toBe('/test/test-tag-1');
      // The replacement is still usable: its own completion may close it.
      fireEvent.click(byId(editor.save));
      await waitFor(() =>
        expect(document.getElementById(editor.field)).toBeNull()
      );
      expect(await stored(editor.kind, 'new draft')).toBe(1);
    } finally {
      await pending.finish();
    }
  }
);

it.each([
  '/test/test-tag-2',
  '/test?entries=all',
  '/test/entries/1',
  '/other/test-tag-1',
])('does not follow a pending selected-tag rename away from %s', async path => {
  const {history} = await renderAppAt('/test/test-tag-1', {act: true});
  await screen.findByText('entry-1-subject');
  const editor = selectedTagEditor;
  const pending = pauseWrite('renameTag');
  try {
    fireEvent.change(await openEditor(editor), {
      target: {value: 'saved draft'},
    });
    fireEvent.click(byId(editor.save));
    await pending.entered;
    fireEvent.click(byId(editor.cancel));
    await act(async () => history.push(path));

    await pending.finish();

    expect(await stored('renameTag', 'saved draft')).toBe(1);
    expect(history.location.pathname + history.location.search).toBe(path);
  } finally {
    await pending.finish();
  }
});

it.each(['different user', 'replacement session', 'replacement account'])(
  'does not follow an old rename into a %s on the same route',
  async change => {
    const {history} = await renderAppAt('/test/test-tag-1', {act: true});
    await screen.findByText('entry-1-subject');
    const session = syncSession(TEST_USER);
    await act(async () => session.sync.flush());
    const original = await session.db.tags.get([TEST_USER, '1']);
    invariant(original, 'the selected tag is stored');
    const editor = selectedTagEditor;
    const pending = pauseWrite('renameTag', 'after');
    try {
      fireEvent.change(await openEditor(editor), {
        target: {value: 'saved draft'},
      });
      await act(async () => {
        fireEvent.click(byId(editor.save));
        await pending.entered;
        await session.sync.flush();
      });
      expect(await stored('renameTag', 'saved draft')).toBe(1);
      fireEvent.click(byId(editor.cancel));
      await act(async () => {
        if (change === 'different user') {
          useAppState.getState().setLoggedInUser('other');
        } else if (change === 'replacement session') {
          const ending = endSyncSession(TEST_USER);
          expect(syncSession(TEST_USER)).not.toBe(session);
          await ending;
        } else {
          await claimData(TEST_USER, 'replacement-account');
          await session.db.tags.put({
            ...original,
            relationships: {
              user: {data: {type: 'User', id: 'replacement-account'}},
            },
          });
        }
      });
      if (change === 'different user') {
        // Signing in navigates to that account; explicitly revisit the old route.
        await act(async () => history.push('/test/test-tag-1'));
      }
      expect(history.location.pathname).toBe('/test/test-tag-1');
      await pending.finish();
      expect(history.location.pathname).toBe('/test/test-tag-1');
    } finally {
      await pending.finish();
    }
  }
);

it.each(['Cancel', 'Escape'])(
  'follows a selected-tag rename after %s without closing its replacement draft',
  async close => {
    const {history} = await renderAppAt('/test/test-tag-1', {act: true});
    await screen.findByText('entry-1-subject');
    const editor = selectedTagEditor;
    const pending = pauseWrite('renameTag');
    try {
      fireEvent.change(await openEditor(editor), {
        target: {value: 'saved / draft'},
      });
      fireEvent.click(byId(editor.save));
      await pending.entered;
      if (close === 'Escape') {
        fireEvent.keyDown(byId(editor.field), {key: close, code: close});
      } else {
        fireEvent.click(byId(editor.cancel));
      }
      expect(document.getElementById(editor.field)).toBeNull();
      fireEvent.change(await openEditor(editor), {
        target: {value: 'replacement / draft'},
      });

      await pending.finish();

      expect(await stored('renameTag', 'saved / draft')).toBe(1);
      expect(byId(editor.field)).toHaveValue('replacement / draft');
      expect(history.location.pathname).toBe('/test/saved%20%2F%20draft');
      expect(
        fireEvent.keyDown(byId(editor.field), {
          key: 'ArrowLeft',
          code: 'ArrowLeft',
        })
      ).toBe(true);
      expect(await screen.findByText('entry-1-subject')).toBeInTheDocument();
      // The surviving draft follows the now-renamed row, not its old name.
      fireEvent.click(byId(editor.save));
      await waitFor(() =>
        expect(document.getElementById(editor.field)).toBeNull()
      );
      expect(await stored('renameTag', 'replacement / draft')).toBe(1);
      expect(history.location.pathname).toBe('/test/replacement%20%2F%20draft');
      expect(await screen.findByText('entry-1-subject')).toBeInTheDocument();
    } finally {
      await pending.finish();
    }
  }
);
