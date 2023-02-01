import DarkMode from './menu_items/DarkMode';
import LightMode from './menu_items/LightMode';
import React from 'react';
import ShowTagCounts from './menu_items/ShowTagCounts';
import StyledDivider from '../../styled/StyledDivider';
import {StyledMenu} from '../../MenuBar';

interface IProps {
  onClose: () => void;
  anchorEl: HTMLElement | null;
}

const ViewMenu = function ({onClose, anchorEl}: IProps) {
  return (
    <StyledMenu
      id="view-menu"
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
    >
      <LightMode onClose={onClose} />
      <DarkMode onClose={onClose} />
      <StyledDivider />
      <ShowTagCounts onClose={onClose} />
    </StyledMenu>
  );
};

export default React.memo(ViewMenu);
