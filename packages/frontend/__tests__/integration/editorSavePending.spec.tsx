import {
  act,
  cleanup,
  fireEvent,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import invariant from 'invariant';
import {vi} from 'vitest';
import {
  type SaveEvent,
  type SaveState,
  transitionSave,
  useSaveError,
} from '../../src/hooks/useSaveError';
import * as tagRename from '../../src/lib/data/tagRename';
import * as writes from '../../src/lib/data/writes';
import {syncSession} from '../../src/lib/sync/session';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {serveMockApi} from '../util/msw';
import {observeSyncWork} from '../util/observeSyncWork';
import {signIn, TEST_USER} from '../util/signIn';
import {renderAppAt} from '../util/TestAppRouter';

serveMockApi();
let finishSync: () => Promise<void>;
beforeEach(() => {
  signIn();
  assignLoggedInCookie();
  finishSync = observeSyncWork(TEST_USER).finish;
});
afterEach(async () => {
  cleanup();
  // Unmount stops scheduling, but actual queued work still owns the database.
  await finishSync();
});

const editors = [
  {
    kind: 'createEntry',
    label: 'entry-1-subject',
    menu: 'New Entry',
    field: 'textEntryNew-1-topSubject',
    body: 'textEntryNew-1-topBody',
    save: 'textEntryNew-1-topSave',
    cancel: 'textEntryNew-1-topCancel',
  },
  {
    kind: 'updateEntry',
    label: 'entry-1-subject',
    menu: 'Edit',
    field: 'textEntryEdit1Subject',
    body: 'textEntryEdit1Body',
    save: 'textEntryEdit1Save',
    cancel: 'textEntryEdit1Cancel',
  },
  {
    kind: 'createTag',
    label: 'test-tag-2',
    menu: 'New Tag',
    field: 'tagNewTopTextField',
    body: null,
    save: 'tagNewTopSave',
    cancel: 'tagNewTopCancel',
  },
  {
    kind: 'renameTag',
    label: 'test-tag-2',
    menu: 'Edit Tag',
    field: 'tagEditTagName2',
    body: null,
    save: 'tagEditSave2',
    cancel: 'tagEditCancel2',
  },
] as const;
type Editor = (typeof editors)[number];

const ready: SaveState = {status: 'ready', request: 0};
const saving: SaveState = {status: 'saving', request: 1};
const failed: SaveState = {status: 'failed', request: 1, error: 'Not saved'};
const transitions: {
  name: string;
  state: SaveState;
  event: SaveEvent;
  next: SaveState;
}[] = [
  {
    name: 'starts immediately',
    state: ready,
    event: {type: 'start'},
    next: saving,
  },
  {
    name: 'ignores duplicate starts',
    state: saving,
    event: {type: 'start'},
    next: saving,
  },
  {
    name: 'finishes the current save',
    state: saving,
    event: {type: 'succeeded', request: 1},
    next: {status: 'ready', request: 1},
  },
  {
    name: 'retains the write error',
    state: saving,
    event: {type: 'failed', request: 1, error: 'Not saved'},
    next: failed,
  },
  {
    name: 'retries with a fresh request',
    state: failed,
    event: {type: 'start'},
    next: {status: 'saving', request: 2},
  },
  {
    name: 'starts again on the same instance',
    state: {status: 'ready', request: 1},
    event: {type: 'start'},
    next: {status: 'saving', request: 2},
  },
  {
    name: 'ignores stale success',
    state: saving,
    event: {type: 'succeeded', request: 0},
    next: saving,
  },
  {
    name: 'ignores stale failure',
    state: saving,
    event: {type: 'failed', request: 0, error: 'stale'},
    next: saving,
  },
  {
    name: 'ignores an idle completion',
    state: ready,
    event: {type: 'succeeded', request: 0},
    next: ready,
  },
  {
    name: 'does not erase failure on late success',
    state: failed,
    event: {type: 'succeeded', request: 1},
    next: failed,
  },
  {
    name: 'does not replace a settled failure',
    state: failed,
    event: {type: 'failed', request: 1, error: 'other'},
    next: failed,
  },
];

it.each(transitions)('$name', ({state, event, next}) => {
  const result = transitionSave(state, event);
  expect(result).toEqual(next);
  if (next === state) expect(result).toBe(state);
});

it('starts storage synchronously and rejects a second save before rerender', async () => {
  const pending = Promise.withResolvers<void>();
  const write = vi.fn(() => pending.promise);
  const stored = vi.fn();
  const {result} = renderHook(() => useSaveError('save draft'));
  const completions: Promise<void>[] = [];
  try {
    act(() => {
      const save = result.current.save;
      completions.push(save(write, stored));
      expect(write).toHaveBeenCalledOnce();
      completions.push(save(write, stored));
      expect(write).toHaveBeenCalledOnce();
    });
    expect(stored).not.toHaveBeenCalled();
  } finally {
    await act(async () => {
      pending.resolve();
      await Promise.all(completions);
    });
  }
  expect(stored).toHaveBeenCalledOnce();
});

function byId(id: string): HTMLElement {
  const element = document.getElementById(id);
  invariant(element, `#${id} is rendered`);
  return element;
}

async function openEditor(editor: Editor) {
  fireEvent.contextMenu(screen.getByText(editor.label));
  fireEvent.click(await screen.findByRole('menuitem', {name: editor.menu}));
  const user = userEvent.setup();
  const field = byId(editor.field);
  await user.clear(field);
  await user.type(field, 'saved draft');
  if (editor.body !== null) {
    await user.clear(byId(editor.body));
    await user.type(byId(editor.body), 'saved body');
  }
  return user;
}

const originalWrites = {...writes};

/** Start the real write immediately, but hold its completion at the editor. */
function holdCompletion(kind: Editor['kind']) {
  const resume = Promise.withResolvers<void>();
  const entered = Promise.withResolvers<void>();
  const followUp = vi.spyOn(tagRename, 'isCurrentTagRename');
  let result: Promise<unknown> | undefined;
  const original = originalWrites;
  // The non-void writes need their stored row for the real completion path.
  const pause =
    <Args extends unknown[], Result>(
      write: (...args: Args) => Promise<Result>
    ) =>
    (...args: Args): Promise<Result> => {
      const pending = (async () => {
        const stored = await write(...args);
        entered.resolve();
        await resume.promise;
        return stored;
      })();
      result = pending;
      return pending;
    };
  const calls =
    kind === 'createEntry'
      ? vi
          .spyOn(writes, kind)
          .mockImplementationOnce(pause(original.createEntry))
      : kind === 'updateEntry'
        ? vi
            .spyOn(writes, kind)
            .mockImplementationOnce(pause(original.updateEntry))
        : kind === 'createTag'
          ? vi
              .spyOn(writes, kind)
              .mockImplementationOnce(pause(original.createTag))
          : vi
              .spyOn(writes, kind)
              .mockImplementationOnce(pause(original.renameTag));
  return {
    calls,
    entered: entered.promise,
    finish: () =>
      act(async () => {
        resume.resolve();
        await result;
        await Promise.all(followUp.mock.results.map(read => read.value));
      }),
  };
}

async function storedDrafts(editor: Editor) {
  const {db} = syncSession(TEST_USER);
  return act(async () =>
    editor.body === null
      ? db.tags.filter(row => row.attributes.name === 'saved draft').toArray()
      : db.entries
          .filter(row => row.attributes.subject === 'saved draft')
          .toArray()
  );
}

it.each(editors)(
  '$kind freezes its pending draft and Save while keeping Cancel reachable',
  async editor => {
    await renderAppAt('/test/test-tag-1', {act: true});
    await screen.findByText('entry-1-subject');
    const user = await openEditor(editor);
    const pending = holdCompletion(editor.kind);
    try {
      await user.click(byId(editor.save));
      await act(async () => pending.entered);
      await user.type(byId(editor.field), ' discarded edit');
      expect(byId(editor.field)).toHaveValue('saved draft');
      if (editor.body !== null) {
        await user.type(byId(editor.body), ' discarded body');
        expect(byId(editor.body)).toHaveValue('saved body');
      }
      expect(byId(editor.save)).toBeDisabled();
      expect(byId(editor.save)).toHaveClass('Mui-disabled');
      expect(byId(editor.field)).toHaveAttribute('readonly');
      expect(byId(editor.cancel)).toBeEnabled();
      // A disabled MUI button rejects pointer targeting; synthetic clicks still
      // probe the save guard without weakening the user-facing disabled check.
      fireEvent.click(byId(editor.save));
      expect(pending.calls).toHaveBeenCalledOnce();
      if (editor.body !== null) {
        await user.click(byId(editor.field));
        await user.tab();
        expect(byId(editor.body)).toHaveFocus();
        await user.tab();
        expect(byId(editor.cancel)).toHaveFocus();
        await user.tab();
        expect(byId(editor.field)).toHaveFocus();
      }
      if (editor.body === null) {
        expect(byId(editor.field)).toHaveFocus();
        await user.tab();
        expect(byId(editor.cancel)).toHaveFocus();
        await user.tab({shift: editor.kind === 'renameTag'});
        expect(byId(editor.field)).toHaveFocus();
      }
      await user.click(byId(editor.cancel));
      expect(document.getElementById(editor.field)).toBeNull();
      await pending.finish();
      expect(pending.calls).toHaveBeenCalledOnce();
      expect(await storedDrafts(editor)).toHaveLength(1);
    } finally {
      await pending.finish();
    }
  }
);

it.each(editors)(
  '$kind prevents two starts in the same event turn',
  async editor => {
    await renderAppAt('/test/test-tag-1', {act: true});
    await screen.findByText('entry-1-subject');
    await openEditor(editor);
    const pending = holdCompletion(editor.kind);
    try {
      act(() => {
        fireEvent.click(byId(editor.save));
        fireEvent.click(byId(editor.save));
      });
      await act(async () => pending.entered);
      expect(pending.calls).toHaveBeenCalledOnce();
      await pending.finish();
      await waitFor(() =>
        expect(document.getElementById(editor.field)).toBeNull()
      );
      expect(await storedDrafts(editor)).toHaveLength(1);
    } finally {
      await pending.finish();
    }
  }
);

it.each(editors)(
  '$kind unlocks a failed draft for typing and a successful retry',
  async editor => {
    await renderAppAt('/test/test-tag-1', {act: true});
    await screen.findByText('entry-1-subject');
    const user = await openEditor(editor);
    const failure = new Error('write unavailable');
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failedWrite = vi
      .spyOn(writes, editor.kind)
      .mockRejectedValueOnce(failure);
    await user.click(byId(editor.save));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Not saved: write unavailable'
    );
    expect(byId(editor.save)).toBeEnabled();
    expect(byId(editor.field)).toHaveFocus();
    await user.type(byId(editor.field), ' retry');
    expect(byId(editor.field)).toHaveValue('saved draft retry');
    if (editor.body !== null) {
      await user.type(byId(editor.body), ' retry');
      expect(byId(editor.body)).toHaveValue('saved body retry');
    }
    await user.clear(byId(editor.field));
    await user.type(byId(editor.field), 'saved draft');
    const pending = holdCompletion(editor.kind);
    try {
      await user.click(byId(editor.save));
      await act(async () => pending.entered);
      expect(screen.queryByRole('alert')).toBeNull();
      expect(byId(editor.save)).toBeDisabled();
      await pending.finish();
      await waitFor(() =>
        expect(document.getElementById(editor.field)).toBeNull()
      );
      expect(await storedDrafts(editor)).toHaveLength(1);
      expect(failedWrite).toHaveBeenCalledTimes(2);
      const what =
        editor.kind === 'renameTag'
          ? 'update tag'
          : editor.kind.replace('Entry', ' entry').replace('Tag', ' tag');
      expect(errors).toHaveBeenCalledExactlyOnceWith(
        `Failed to ${what}:`,
        failure
      );
    } finally {
      await pending.finish();
    }
  }
);

it.each(editors)(
  '$kind keeps keyboard cancellation available after a keyboard save',
  async editor => {
    await renderAppAt('/test/test-tag-1', {act: true});
    await screen.findByText('entry-1-subject');
    const user = await openEditor(editor);
    const pending = holdCompletion(editor.kind);
    try {
      await user.tab();
      expect(byId(editor.save)).toHaveFocus();
      await user.keyboard('{Enter}');
      await act(async () => pending.entered);
      // Do not leave focus on a now-disabled control (or on the document).
      expect(byId(editor.field)).toHaveFocus();
      if (editor.body === null) {
        await user.keyboard('{Escape}');
      } else {
        await user.tab();
        expect(byId(editor.body)).toHaveFocus();
        await user.tab();
        expect(byId(editor.cancel)).toHaveFocus();
        await user.keyboard('{Enter}');
      }
      expect(document.getElementById(editor.field)).toBeNull();
      await pending.finish();
      expect(await storedDrafts(editor)).toHaveLength(1);
    } finally {
      await pending.finish();
    }
  }
);
