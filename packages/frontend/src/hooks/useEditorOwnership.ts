import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {useAppState} from '../lib/state/appState';
import type {EditorOwner} from '../lib/state/editorOwnership';

/** One registration per mounted form, shared by entries and tags. */
export function useEditorOwnership(
  mode: EditorOwner['mode'],
  autoFocus: boolean
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
    // Hand back focus only if it disappeared with the closing form. A save
    // completing after the user focused another control must not steal it.
    if (
      active &&
      (!document.activeElement || document.activeElement === document.body)
    ) {
      ref.current?.querySelector<HTMLElement>('input, textarea')?.focus();
    }
  }, [active]);

  const ownsKeyboard = () => {
    const state = useAppState.getState().editorOwnership;
    return state.status === 'editing' && state.active.id === editor.id;
  };
  const onFocusCapture = () => {
    useAppState.getState().sendEditorOwnership({type: 'focus', id: editor.id});
  };
  return {ref, ownsKeyboard, onFocusCapture};
}
