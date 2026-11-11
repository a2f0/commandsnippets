import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {useAppState} from '../lib/state/appState';
import type {EditorOwner} from '../lib/state/editorOwnership';

/** One registration per mounted form, shared by entries and tags. */
export function useEditorOwnership(
  mode: EditorOwner['mode'],
  autoFocus: boolean,
  saving = false
) {
  const [editor] = useState<EditorOwner>(() => ({id: Symbol('editor'), mode}));
  const ref = useRef<HTMLDivElement>(null);
  const active = useAppState(
    ({editorOwnership}) =>
      editorOwnership.status === 'editing' &&
      editorOwnership.active.id === editor.id
  );
  useLayoutEffect(() => {
    const {sendEditorOwnership} = useAppState.getState();
    sendEditorOwnership({type: 'open', editor});
    return () => sendEditorOwnership({type: 'close', id: editor.id});
  }, [editor]);

  // After a closing menu restores its former focus, focus the new draft.
  useEffect(() => {
    if (autoFocus)
      ref.current?.querySelector<HTMLElement>('input, textarea')?.focus();
  }, [autoFocus]);

  useEffect(() => {
    // Recover focus lost with a closing form or a now-disabled Save. A save
    // completing after the user focused another control must not steal it.
    if (
      active &&
      (!document.activeElement ||
        document.activeElement === document.body ||
        (saving &&
          ref.current?.contains(document.activeElement) &&
          document.activeElement.matches(':disabled')))
    ) {
      ref.current?.querySelector<HTMLElement>('input, textarea')?.focus();
    }
  }, [active, saving]);

  const ownsKeyboard = () => {
    const state = useAppState.getState().editorOwnership;
    return state.status === 'editing' && state.active.id === editor.id;
  };
  const onFocusCapture = () => {
    useAppState.getState().sendEditorOwnership({type: 'focus', id: editor.id});
  };
  return {ref, ownsKeyboard, onFocusCapture};
}
