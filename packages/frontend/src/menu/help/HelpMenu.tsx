import React from 'react';

import {StyledMenu} from '../StyledMenu';
import {About} from './menuItems/About';

interface IProps {
  onClose: () => void;
  anchorEl: HTMLElement | null;
}

const HelpMenu = ({onClose, anchorEl}: IProps) => (
  <StyledMenu
    id="help-menu"
    anchorEl={anchorEl}
    open={Boolean(anchorEl)}
    onClose={onClose}
  >
    <About onClose={onClose} />
  </StyledMenu>
);

const memoizedHelpMenu = React.memo(HelpMenu);

export {memoizedHelpMenu as HelpMenu};
