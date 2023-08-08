import PopulateIndexedDB from './menu_items/PopulateIndexedDB';
import React from 'react';
import {StyledMenu} from '../../MenuBar';

interface IProps {
  onClose: () => void;
  anchorEl: HTMLElement | null;
}

const DebugMenu = function ({onClose, anchorEl}: IProps) {
  return (
    <StyledMenu
      id="debug-menu"
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
    >
      <PopulateIndexedDB onClose={onClose} />
    </StyledMenu>
  );
};

export default React.memo(DebugMenu);
