import {Menu} from '@mui/material';
import type React from 'react';
import type {IMouse} from '../lib/shared';

interface IContextMenuProps {
  id: string;
  /**
   * Where it was opened (`useContextMenu`), or nowhere (null coordinates):
   * closed.
   */
  mouse: IMouse;
  onClose: () => void;
  /**
   * Keep it in the document while closed: a list's one menu. A row's is
   * not kept: closed, it renders nothing, so a list does not carry a whole
   * menu (in a portal of its own) for every row.
   */
  keepMounted?: boolean;
  children: React.ReactNode;
}

/**
 * A menu opened where the user right-clicked (or below a button): a row's,
 * a list's.
 */
export const ContextMenu = ({
  id,
  mouse,
  onClose,
  keepMounted = false,
  children,
}: IContextMenuProps) => (
  <Menu
    id={id}
    keepMounted={keepMounted}
    open={mouse.mouseY !== null}
    onClose={onClose}
    anchorReference="anchorPosition"
    anchorPosition={
      mouse.mouseY !== null && mouse.mouseX !== null
        ? {top: mouse.mouseY, left: mouse.mouseX}
        : {top: 0, left: 0}
    }
  >
    {children}
  </Menu>
);
