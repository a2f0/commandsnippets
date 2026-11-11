import {act, cleanup, fireEvent, screen, waitFor} from '@testing-library/react';
import invariant from 'invariant';
import {type MockResult, vi} from 'vitest';
import * as saveHook from '../../src/hooks/useSaveError';

import * as writes from '../../src/lib/data/writes';
import * as appState from '../../src/lib/state/appState';
import {useAppState} from '../../src/lib/state/appState';
import {boundAccount} from '../../src/lib/sync/accountBinding';
import {remap} from '../../src/lib/sync/adopt';
import * as sessions from '../../src/lib/sync/session';
import {
  claimData,
  endSyncSession,
  syncSession,
} from '../../src/lib/sync/session';
import * as syncReads from '../../src/lib/sync/sync';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {mockResult} from '../util/mockResult';
import {serveMockApi} from '../util/msw';
import {signIn, TEST_USER} from '../util/signIn';
import {testUser} from '../util/storeFixtures';
import {renderAppAt} from '../util/TestAppRouter';

serveMockApi();
let pageWork: ReturnType<typeof observePageWork>;
let saves: ReturnType<typeof observeSaves>;
beforeEach(() => {
  signIn();
  assignLoggedInCookie();
  pageWork = observePageWork();
  saves = observeSaves();
});
afterEach(async () => {
  try {
    await saves.finish();
    await pageWork.settle();
  } finally {
    cleanup();
  }
});

/** The save includes identity capture, persistence and its parent callbacks. */
function observeSaves() {
  const completions: Promise<void>[] = [];
  const original = saveHook.useSaveError;
  vi.spyOn(saveHook, 'useSaveError').mockImplementation(what => {
    const state = original(what);
    const save: typeof state.save = (...args) => {
      const completion = state.save(...args);
      completions.push(completion);
      return completion;
    };
    return {...state, save};
  });
  const finish = () =>
    act(async () => {
      await Promise.all(completions);
    });
  return {
    finish,
    click: async (id: string) => {
      const count = completions.length;
      await act(async () => {
        fireEvent.click(byId(id));
        expect(completions).toHaveLength(count + 1);
        const completion = completions[count];
        invariant(completion, 'Save returned its completion promise');
        await completion;
      });
      await pageWork.settle();
    },
  };
}

/** Follow real session replacements, destination syncs and history reads too. */
function observePageWork() {
  const observed: {
    name: string;
    operation: {mock: {results: readonly MockResult<Promise<unknown>>[]}};
  }[] = [
    {name: 'isTagSynced', operation: vi.spyOn(syncReads, 'isTagSynced')},
    {name: 'endSyncSession', operation: vi.spyOn(sessions, 'endSyncSession')},
    {
      name: 'leaveForeignSession',
      operation: vi.spyOn(appState, 'leaveForeignSession'),
    },
  ];
  const known = new Set<sessions.SyncSession>();
  const observe = (session: sessions.SyncSession) => {
    if (known.has(session)) return session;
    known.add(session);
    for (const name of [
      'flush',
      'syncAll',
      'syncTag',
      'entryReuses',
    ] as const) {
      observed.push({
        name: `${session.username}/${session.owner}:${name}`,
        operation: vi.spyOn(session.sync, name),
      });
    }
    return session;
  };
  const own = sessions.syncSession;
  const publicSession = sessions.publicSyncSession;
  vi.spyOn(sessions, 'syncSession').mockImplementation((...args) =>
    observe(own(...args))
  );
  vi.spyOn(sessions, 'publicSyncSession').mockImplementation((...args) =>
    observe(publicSession(...args))
  );
  const joined = new Set<Promise<unknown>>();
  return {
    collections: () =>
      observed
        .filter(({name}) => name.endsWith(':syncAll'))
        .flatMap(({name, operation}) => operation.mock.results.map(() => name)),
    settle: async (expectedFailures: unknown[] = []) => {
      const failures: unknown[] = [];
      for (;;) {
        const pending: {name: string; promise: Promise<unknown>}[] = [];
        for (const {name, operation} of observed) {
          for (let index = 0; index < operation.mock.results.length; index++) {
            const promise = mockResult<Promise<unknown>>(operation, index);
            if (!joined.has(promise)) {
              joined.add(promise);
              pending.push({name, promise});
            }
          }
        }
        if (pending.length === 0) break;
        await act(async () => {
          // Join every started operation even if an intentional replacement
          // rejects one; assert every rejection below rather than swallowing it.
          const results = await Promise.allSettled(
            pending.map(({promise}) => promise)
          );
          for (const [index, result] of results.entries()) {
            if (result.status === 'rejected') {
              const operation = pending[index];
              invariant(operation, 'the rejected operation was observed');
              failures.push({
                name: operation.name,
                reason: result.reason,
              });
            }
          }
        });
      }
      expect(failures).toEqual(expectedFailures);
    },
  };
}

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
  await act(async () => fireEvent.contextMenu(screen.getByText(editor.label)));
  const item = await screen.findByRole('menuitem', {name: editor.menu});
  await act(async () => fireEvent.click(item));
  if (editor.kind === 'createEntry') {
    fireEvent.change(byId('textEntryNew-1-topBody'), {target: {value: 'body'}});
  }
  return byId(editor.field);
}

/** Pause the real local write, not its persistence or the editor's callback. */
function pauseWrite(
  kind: Editor['kind'],
  when: 'before' | 'after' = 'before',
  failure?: string
) {
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
    finish: async () => {
      await act(async () => {
        resume.resolve();
        invariant(result, 'the held write started');
        if (failure === undefined) await result;
        else await expect(result).rejects.toMatchObject({name: failure});
      });
      // The write alone finishes before the persisted-rename read is even
      // called. Join the actual save, including that read and its route callback.
      await saves.finish();
    },
  };
}

async function stored(kind: Editor['kind'], value: string) {
  const {db} = syncSession(TEST_USER);
  if (kind === 'createEntry' || kind === 'updateEntry') {
    return act(async () =>
      db.entries.filter(row => row.attributes.subject === value).count()
    );
  }
  return act(async () =>
    db.tags.filter(row => row.attributes.name === value).count()
  );
}

it.each([
  ['unbound', 'none'],
  ['bound before first sync', 'none'],
  ['bound before first sync', 'before'],
  ['bound before first sync', 'after'],
])(
  'follows the first locally created selected tag while %s, remapped %s persistence',
  async (binding, rekey) => {
    const session = syncSession(TEST_USER);
    vi.spyOn(session.sync, 'flush').mockResolvedValue(undefined);
    vi.spyOn(session.sync, 'syncAll').mockResolvedValue(undefined);
    vi.spyOn(session.sync, 'syncTag').mockResolvedValue(undefined);
    if (binding === 'bound before first sync') {
      await claimData(TEST_USER, testUser.id);
    }
    const {history} = await renderAppAt('/test?entries=all', {act: true});
    await pageWork.settle();
    fireEvent.click(byId('file-menu-button'));
    fireEvent.click(await screen.findByRole('menuitem', {name: 'New Tag'}));
    fireEvent.change(byId('tagNewTopTextField'), {
      target: {value: 'first local tag'},
    });
    await saves.click('tagNewTopSave');
    const firstTag = await screen.findByText('first local tag');
    await act(async () => fireEvent.click(firstTag));
    expect(history.location.pathname).toBe('/test/first%20local%20tag');
    const [object] = await act(async () => session.db.tags.toArray());
    invariant(object, 'the first local tag was created');
    expect(object.relationships.user.data.id).toBe('');
    expect(await act(async () => boundAccount(session.db, TEST_USER))).toBe(
      binding === 'unbound' ? undefined : testUser.id
    );
    const editor: Editor = {
      kind: 'renameTag',
      label: 'first local tag',
      menu: 'Edit Tag',
      field: `tagEditTagName${object.id}`,
      save: `tagEditSave${object.id}`,
      cancel: `tagEditCancel${object.id}`,
    };
    const pending = pauseWrite(
      'renameTag',
      rekey === 'before' ? 'before' : 'after'
    );
    try {
      fireEvent.change(await openEditor(editor), {
        target: {value: 'renamed / offline'},
      });
      await act(async () => {
        fireEvent.click(byId(editor.save));
        await pending.entered;
      });
      if (rekey !== 'before')
        expect(await stored('renameTag', 'renamed / offline')).toBe(1);
      if (rekey !== 'none') {
        await act(async () =>
          session.db.transaction(
            'rw',
            [session.db.tags, session.db.junctions, session.db.outbox],
            async () => {
              await remap(session.db, {
                owner: TEST_USER,
                type: 'Tag',
                from: object.id,
                to: '101',
              });
              await session.db.tags.update([TEST_USER, '101'], {
                relationships: {user: {data: {type: 'User', id: testUser.id}}},
              });
            }
          )
        );
        expect(
          screen.getByDisplayValue('renamed / offline')
        ).toBeInTheDocument();
      }
      await pending.finish();
      await pageWork.settle();
      expect(document.getElementById(editor.field)).toBeNull();
      expect(screen.queryByDisplayValue('renamed / offline')).toBeNull();
      expect(history.location.pathname).toBe('/test/renamed%20%2F%20offline');
      expect(await screen.findByText('renamed / offline')).toBeInTheDocument();
      expect(await stored('renameTag', 'renamed / offline')).toBe(1);
      expect(
        (
          await session.db.tags.get([
            TEST_USER,
            rekey === 'none' ? object.id : '101',
          ])
        )?.attributes.name
      ).toBe('renamed / offline');
      expect(await session.db.outbox.count()).toBe(2);
    } finally {
      await pending.finish();
    }
  }
);

it('never writes a held rename into a replacement account before persistence', async () => {
  const {history} = await renderAppAt('/test/test-tag-1', {act: true});
  await pageWork.settle();
  await screen.findByText('entry-1-subject');
  const session = syncSession(TEST_USER);

  vi.spyOn(session.sync, 'flush').mockResolvedValue(undefined);
  vi.spyOn(session.sync, 'syncAll').mockResolvedValue(undefined);
  vi.spyOn(session.sync, 'syncTag').mockResolvedValue(undefined);
  const original = await session.db.tags.get([TEST_USER, '1']);
  invariant(original, 'the selected tag is stored');
  const failed = vi.spyOn(console, 'error');
  const pending = pauseWrite('renameTag', 'before', 'AccountChangedError');
  try {
    fireEvent.change(await openEditor(selectedTagEditor), {
      target: {value: 'old account draft'},
    });
    await act(async () => {
      fireEvent.click(byId(selectedTagEditor.save));
      await pending.entered;
    });
    await act(async () => {
      await claimData(TEST_USER, 'replacement-account');
      await session.db.tags.put({
        ...original,
        relationships: {
          user: {data: {type: 'User', id: 'replacement-account'}},
        },
      });
    });
    await pending.finish();
    expect((await session.db.tags.get([TEST_USER, '1']))?.attributes.name).toBe(
      'test-tag-1'
    );
    expect(await session.db.outbox.count()).toBe(0);
    expect(history.location.pathname).toBe('/test/test-tag-1');
    expect(failed).toHaveBeenCalledExactlyOnceWith(
      'Failed to update tag:',
      expect.objectContaining({name: 'AccountChangedError'})
    );
  } finally {
    await pending.finish();
  }
});

it.each(editors)(
  '$kind completion leaves a cancelled-and-reopened editor intact',
  async editor => {
    const {history} = await renderAppAt('/test/test-tag-1', {act: true});
    await pageWork.settle();
    await screen.findByText('entry-1-subject');
    const pending = pauseWrite(editor.kind);
    try {
      fireEvent.change(await openEditor(editor), {
        target: {value: 'saved draft'},
      });
      await act(async () => {
        fireEvent.click(byId(editor.save));
        await pending.entered;
      });
      fireEvent.click(byId(editor.cancel));
      expect(document.getElementById(editor.field)).toBeNull();
      fireEvent.change(await openEditor(editor), {
        target: {value: 'new draft'},
      });

      await pending.finish();

      await pageWork.settle();
      expect(await stored(editor.kind, 'saved draft')).toBe(1);
      expect(byId(editor.field)).toHaveValue('new draft');
      expect(history.location.pathname).toBe('/test/test-tag-1');
      // The replacement is still usable: its own completion may close it.
      await saves.click(editor.save);
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
  await pageWork.settle();
  await screen.findByText('entry-1-subject');
  const editor = selectedTagEditor;
  const pending = pauseWrite('renameTag');
  try {
    fireEvent.change(await openEditor(editor), {
      target: {value: 'saved draft'},
    });
    await act(async () => {
      fireEvent.click(byId(editor.save));
      await pending.entered;
    });
    fireEvent.click(byId(editor.cancel));
    await act(async () => history.push(path));

    await pending.finish();

    await pageWork.settle(
      path === '/other/test-tag-1'
        ? [
            {
              name: '/other:syncAll',
              reason: expect.objectContaining({
                name: 'PublicViewChangedError',
                restart: false,
              }),
            },
          ]
        : []
    );
    expect(await stored('renameTag', 'saved draft')).toBe(1);
    expect(history.location.pathname + history.location.search).toBe(path);
    expect(pageWork.collections()).toEqual(
      path === '/other/test-tag-1'
        ? ['test/test:syncAll', '/other:syncAll']
        : path === '/test/entries/1'
          ? ['test/test:syncAll', 'test/test:syncAll']
          : ['test/test:syncAll']
    );
    if (path === '/test/entries/1')
      expect(screen.getByText('Not reused yet.')).toBeInTheDocument();
  } finally {
    await pending.finish();
  }
});

it.each(['different user', 'replacement session', 'replacement account'])(
  'does not follow an old rename into a %s on the same route',
  async change => {
    const {history} = await renderAppAt('/test/test-tag-1', {act: true});
    await pageWork.settle();
    await screen.findByText('entry-1-subject');
    const destinations: string[] = [];
    const stopListening = history.listen(({location}) => {
      destinations.push(location.pathname);
    });
    const session = syncSession(TEST_USER);

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
      });
      await pageWork.settle();
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
      await pageWork.settle(
        change === 'different user'
          ? [
              // The fixture API still answers as test: other is signed out,
              // closing its DB before the collection chained after its flush.
              {
                name: 'other/other:flush',
                reason: expect.objectContaining({
                  name: 'SyncUserError',
                  message: "The API's user is test, not other: not synced",
                }),
              },
              {
                name: 'other/other:syncAll',
                reason: expect.objectContaining({name: 'DatabaseClosedError'}),
              },
            ]
          : []
      );
      if (change === 'different user') {
        expect(useAppState.getState().loggedInUser).toBeNull();
        // This later navigation belongs to the fixture's forced sign-out, not
        // the completed old rename: no stage may follow that rename's URL.
        expect(history.location.pathname).toBe('/');
      } else {
        expect(history.location.pathname).toBe('/test/test-tag-1');
      }
      expect(destinations).not.toContain('/test/saved%20draft');
    } finally {
      await pending.finish();
      stopListening();
    }
  }
);

it.each(['Cancel', 'Escape'])(
  'follows a selected-tag rename after %s without closing its replacement draft',
  async close => {
    const {history} = await renderAppAt('/test/test-tag-1', {act: true});
    await pageWork.settle();
    await screen.findByText('entry-1-subject');
    const editor = selectedTagEditor;
    const pending = pauseWrite('renameTag');
    try {
      fireEvent.change(await openEditor(editor), {
        target: {value: 'saved / draft'},
      });
      await act(async () => {
        fireEvent.click(byId(editor.save));
        await pending.entered;
      });
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

      await pageWork.settle();
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
      await saves.click(editor.save);
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
