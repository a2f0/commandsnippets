import React from 'react';
import {StyledMenu} from '../../MenuBar';
import StyledMenuItem from '../../StyledMenuItem';

interface IProps {
  onClose: () => void;
  anchorEl: HTMLElement | null;
}

const HelpMenu = function ({onClose, anchorEl}: IProps) {
  const handleAbout = () => {
    onClose();
  };

  return (
    <StyledMenu
      id="help-menu"
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
    >
      <StyledMenuItem id="HelpMenuAbout" onClick={handleAbout}>
        About
      </StyledMenuItem>
    </StyledMenu>
  );
};

export default React.memo(HelpMenu);
