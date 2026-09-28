import React from 'react';
import {StyledMenu} from '../../MenuBar';
import {Logout} from './menu_items/Logout';
import {NewEntry} from './menu_items/NewEntry';
import {NewTag} from './menu_items/NewTag';

interface IProps {
  onClose: () => void;
  anchorEl: HTMLElement | null;
  /** New Tag and New Entry need the entries page's editors. */
  entriesPage: boolean;
}

const FileMenu = ({onClose, anchorEl, entriesPage}: IProps) => (
  <StyledMenu
    id="file-menu"
    anchorEl={anchorEl}
    open={Boolean(anchorEl)}
    onClose={onClose}
  >
    {entriesPage && <NewTag onClose={onClose} />}
    {entriesPage && <NewEntry onClose={onClose} />}
    <Logout onClose={onClose} />
  </StyledMenu>
);

const memoizedFileMenu = React.memo(FileMenu);

export {memoizedFileMenu as FileMenu};
