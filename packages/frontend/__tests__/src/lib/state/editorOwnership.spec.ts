import {expectTypeOf} from 'vitest';
import {appMode} from '../../../../src/lib/shared';
import type {AppActions} from '../../../../src/lib/state/appState';
import {
  type EditorOwner,
  type EditorOwnership,
  type EditorOwnershipEvent,
  initialEditorOwnership,
  registeredEditors,
  transitionEditorOwnership,
} from '../../../../src/lib/state/editorOwnership';

const entry: EditorOwner = {id: Symbol('entry'), mode: appMode.entryEditor};
const tag: EditorOwner = {id: Symbol('tag'), mode: appMode.tagEditor};
const entry2: EditorOwner = {id: Symbol('entry2'), mode: appMode.entryEditor};
const tag2: EditorOwner = {id: Symbol('tag2'), mode: appMode.tagEditor};
const missing = Symbol('unmounted');
const editing = (
  active: EditorOwner,
  ...others: EditorOwner[]
): EditorOwnership => ({status: 'editing', active, others});
const released = (
  mode: appMode.tagsList | appMode.entriesList,
  ...editors: EditorOwner[]
): EditorOwnership => ({status: 'released', mode, editors});
type Case = [string, EditorOwnership, EditorOwnershipEvent, EditorOwnership];

const cases: Case[] = [
  [
    'open entry',
    initialEditorOwnership,
    {type: 'open', editor: entry},
    editing(entry),
  ],
  [
    'open tag',
    initialEditorOwnership,
    {type: 'open', editor: tag},
    editing(tag),
  ],
  [
    'entry then tag',
    editing(entry),
    {type: 'open', editor: tag},
    editing(tag, entry),
  ],
  [
    'tag then entry',
    editing(tag),
    {type: 'open', editor: entry},
    editing(entry, tag),
  ],
  [
    'duplicate open',
    editing(entry, tag),
    {type: 'open', editor: tag},
    editing(entry, tag),
  ],
  [
    'focus older',
    editing(tag, entry),
    {type: 'focus', id: entry.id},
    editing(entry, tag),
  ],
  [
    'focus active',
    editing(entry, tag),
    {type: 'focus', id: entry.id},
    editing(entry, tag),
  ],
  [
    'focus unknown in editing',
    editing(entry),
    {type: 'focus', id: missing},
    editing(entry),
  ],
  [
    'focus unknown in released',
    initialEditorOwnership,
    {type: 'focus', id: missing},
    initialEditorOwnership,
  ],
  [
    'close background',
    editing(tag, entry),
    {type: 'close', id: entry.id},
    editing(tag),
  ],
  [
    'close active tag',
    editing(tag, entry),
    {type: 'close', id: tag.id},
    editing(entry),
  ],
  [
    'close active entry',
    editing(entry, tag),
    {type: 'close', id: entry.id},
    editing(tag),
  ],
  [
    'close last entry',
    editing(entry),
    {type: 'close', id: entry.id},
    released(appMode.entriesList),
  ],
  [
    'close last tag',
    editing(tag),
    {type: 'close', id: tag.id},
    initialEditorOwnership,
  ],
  [
    'close unknown in editing',
    editing(entry),
    {type: 'close', id: missing},
    editing(entry),
  ],
  [
    'close unknown in released',
    initialEditorOwnership,
    {type: 'close', id: missing},
    initialEditorOwnership,
  ],
  [
    'list click yields without forgetting forms',
    editing(entry, tag),
    {type: 'release', mode: appMode.tagsList},
    released(appMode.tagsList, entry, tag),
  ],
  [
    'background close preserves selected list',
    released(appMode.entriesList, tag),
    {type: 'close', id: tag.id},
    released(appMode.entriesList),
  ],
  [
    'focus resumes a released form',
    released(appMode.tagsList, tag, entry),
    {type: 'focus', id: entry.id},
    editing(entry, tag),
  ],
  [
    'open after yielding',
    released(appMode.entriesList, tag),
    {type: 'open', editor: entry},
    editing(entry, tag),
  ],
  [
    'pane change while released',
    released(appMode.tagsList, entry),
    {type: 'release', mode: appMode.entriesList},
    released(appMode.entriesList, entry),
  ],
];

it('allows only list modes when the keyboard is released', () => {
  type ListMode = appMode.tagsList | appMode.entriesList;
  expectTypeOf<
    Extract<EditorOwnership, {status: 'released'}>['mode']
  >().toEqualTypeOf<ListMode>();
  expectTypeOf<
    Extract<EditorOwnershipEvent, {type: 'release'}>['mode']
  >().toEqualTypeOf<ListMode>();
  expectTypeOf<
    Parameters<AppActions['setAppMode']>[0]
  >().toEqualTypeOf<ListMode>();
});

it.each(cases)('%s', (_name, state, event, expected) => {
  const before = registeredEditors(state);
  expect(transitionEditorOwnership(state, event)).toEqual(expected);
  expect(registeredEditors(state)).toEqual(before);
});

it.each([appMode.tagsList, appMode.entriesList] as const)(
  'keeps the same state when already released to %s',
  mode => {
    const state = released(mode, entry, tag);
    expect(transitionEditorOwnership(state, {type: 'release', mode})).toBe(
      state
    );
  }
);

it.each([
  [entry, tag],
  [tag, entry],
  [entry, entry2],
  [tag, tag2],
])(
  'retains ownership through both close orders: %o then %o',
  (first, second) => {
    const opened = transitionEditorOwnership(editing(first), {
      type: 'open',
      editor: second,
    });
    for (const [closing, survivor] of [
      [first, second],
      [second, first],
    ]) {
      if (closing === undefined || survivor === undefined)
        throw new Error('both editors are present');
      const remaining = transitionEditorOwnership(opened, {
        type: 'close',
        id: closing.id,
      });
      expect(remaining).toEqual(editing(survivor));
      expect(
        registeredEditors(
          transitionEditorOwnership(remaining, {type: 'close', id: survivor.id})
        )
      ).toEqual([]);
    }
  }
);

it('returns to the most recently focused survivor, not the oldest mount or a captured mode', () => {
  const events: EditorOwnershipEvent[] = [
    {type: 'open', editor: entry},
    {type: 'open', editor: tag},
    {type: 'open', editor: entry2},
    {type: 'focus', id: entry.id},
    {type: 'close', id: entry.id},
  ];
  expect(
    events.reduce(transitionEditorOwnership, initialEditorOwnership)
  ).toEqual(editing(entry2, tag));
});

it('ignores stale cleanup and focus after reset and reopen', () => {
  const reopened = transitionEditorOwnership(initialEditorOwnership, {
    type: 'open',
    editor: entry2,
  });
  expect(
    transitionEditorOwnership(reopened, {type: 'close', id: entry.id})
  ).toBe(reopened);
  expect(
    transitionEditorOwnership(reopened, {type: 'focus', id: entry.id})
  ).toBe(reopened);
});
