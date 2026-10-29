import type React from 'react';
import {useCallback, useState} from 'react';
import {type IMouse, initialMouse} from '../lib/shared';

export interface ContextMenuState {
  /** Where the menu is open (`ContextMenu`'s `mouse`), or `initialMouse`. */
  mouse: IMouse;
  /**
   * An `onContextMenu` handler: opens the menu just above and left of the
   * pointer, instead of the browser's, or an enclosing element's.
   */
  onContextMenu: (event: React.MouseEvent) => void;
  /** Open the menu at `mouse` (below a button, say). */
  openAt: (mouse: IMouse) => void;
  close: () => void;
}

/**
 * Where a context menu is open. Its functions stay the same across renders,
 * so a memoized row given them does not render again.
 */
export function useContextMenu(): ContextMenuState {
  const [mouse, setMouse] = useState(initialMouse);
  const onContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setMouse({mouseX: event.clientX - 2, mouseY: event.clientY - 4});
  }, []);
  const close = useCallback(() => setMouse(initialMouse), []);
  return {mouse, onContextMenu, openAt: setMouse, close};
}
