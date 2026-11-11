import {appMode} from '../shared';

export type ListMode = appMode.tagsList | appMode.entriesList;

export interface EditorOwner {
  readonly id: symbol;
  readonly mode: appMode.entryEditor | appMode.tagEditor;
}

/** Editors are ordered by their most recent open/focus, newest first. */
export type EditorOwnership =
  | {status: 'released'; mode: ListMode; editors: readonly EditorOwner[]}
  | {status: 'editing'; active: EditorOwner; others: readonly EditorOwner[]};

export type EditorOwnershipEvent =
  | {type: 'open'; editor: EditorOwner}
  | {type: 'focus'; id: symbol}
  | {type: 'close'; id: symbol}
  | {type: 'release'; mode: ListMode};

export const initialEditorOwnership: EditorOwnership = {
  status: 'released',
  mode: appMode.tagsList,
  editors: [],
};

export const registeredEditors = (
  state: EditorOwnership
): readonly EditorOwner[] =>
  state.status === 'editing' ? [state.active, ...state.others] : state.editors;

export const editorOwnershipMode = (state: EditorOwnership): appMode =>
  state.status === 'editing' ? state.active.mode : state.mode;

/** Closing a background form cannot change the keyboard's current owner. */
function closeEditor(state: EditorOwnership, id: symbol): EditorOwnership {
  const editors = registeredEditors(state);
  if (!editors.some(editor => editor.id === id)) return state;
  const remaining = editors.filter(editor => editor.id !== id);
  if (state.status === 'released') return {...state, editors: remaining};
  if (state.active.id !== id) return {...state, others: remaining.slice(1)};
  const [active, ...others] = remaining;
  return active === undefined
    ? {
        status: 'released',
        mode:
          state.active.mode === appMode.entryEditor
            ? appMode.entriesList
            : appMode.tagsList,
        editors: [],
      }
    : {status: 'editing', active, others};
}

/** The sole ownership transition; registration has no asynchronous work. */
export function transitionEditorOwnership(
  state: EditorOwnership,
  event: EditorOwnershipEvent
): EditorOwnership {
  const editors = registeredEditors(state);
  switch (event.type) {
    case 'open':
      return editors.some(editor => editor.id === event.editor.id)
        ? state
        : {status: 'editing', active: event.editor, others: editors};
    case 'focus': {
      const active = editors.find(editor => editor.id === event.id);
      if (
        active === undefined ||
        (state.status === 'editing' && state.active.id === event.id)
      )
        return state;
      return {
        status: 'editing',
        active,
        others: editors.filter(editor => editor.id !== event.id),
      };
    }
    case 'close':
      return closeEditor(state, event.id);
    case 'release':
      if (state.status === 'released' && state.mode === event.mode)
        return state;
      return {status: 'released', mode: event.mode, editors};
    default:
      return assertNever(event);
  }
}

function assertNever(event: never): never {
  throw new Error(`Unhandled editor ownership event: ${JSON.stringify(event)}`);
}
