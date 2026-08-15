import React from 'react';
import {StyledMenu} from '../../MenuBar';
import {Logout} from './menu_items/Logout';
import {NewEntry} from './menu_items/NewEntry';
import {NewTag} from './menu_items/NewTag';

interface IProps {
  onClose: () => void;
  anchorEl: HTMLElement | null;
}

const FileMenu = ({onClose, anchorEl}: IProps) => (
  <StyledMenu
    id="file-menu"
    anchorEl={anchorEl}
    open={Boolean(anchorEl)}
    onClose={onClose}
  >
    <NewTag onClose={onClose} />
    <NewEntry onClose={onClose} />
    <Logout onClose={onClose} />
  </StyledMenu>
);

const memoizedFileMenu = React.memo(FileMenu);

export {memoizedFileMenu as FileMenu};
