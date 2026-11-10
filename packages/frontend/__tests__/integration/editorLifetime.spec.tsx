import {act, fireEvent, screen, waitFor} from '@testing-library/react';
import invariant from 'invariant';
import {vi} from 'vitest';
import * as writes from '../../src/lib/data/writes';
import {syncSession} from '../../src/lib/sync/session';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {serveMockApi} from '../util/msw';
import {signIn, TEST_USER} from '../util/signIn';
import {renderAppAt} from '../util/TestAppRouter';

serveMockApi();
beforeEach(() => {
  signIn();
  assignLoggedInCookie();
});

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
type Editor = (typeof editors)[number];

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
function pauseWrite(kind: Editor['kind']) {
  const entered = Promise.withResolvers<void>();
  const resume = Promise.withResolvers<void>();
  let result: Promise<unknown> | undefined;
  const hold =
    <Args extends unknown[], Result>(
      write: (...args: Args) => Promise<Result>
    ) =>
    (...args: Args): Promise<Result> => {
      entered.resolve();
      const pending = resume.promise.then(() => write(...args));
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
