import React from 'react';

import {StyledMenu} from '../../MenuBar';
import StyledDivider from '../../styled/StyledDivider';
import DarkMode from './menu_items/DarkMode';
import LightMode from './menu_items/LightMode';
import ShowTagCounts from './menu_items/ShowTagCounts';

interface IProps {
  onClose: () => void;
  anchorEl: HTMLElement | null;
}

const ViewMenu = ({onClose, anchorEl}: IProps) => (
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

export default React.memo(ViewMenu);
