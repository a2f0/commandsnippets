import React from 'react';

import {StyledMenu} from '../../MenuBar';
import About from './menu_items/About';

interface IProps {
  onClose: () => void;
  anchorEl: HTMLElement | null;
}

const HelpMenu = function ({onClose, anchorEl}: IProps) {
  return (
    <StyledMenu
      id="help-menu"
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
    >
      <About onClose={onClose} />
    </StyledMenu>
  );
};

export default React.memo(HelpMenu);
