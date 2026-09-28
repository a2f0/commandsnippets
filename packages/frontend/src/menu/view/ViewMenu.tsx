import React from 'react';
import {StyledDivider} from '../../styled/StyledDivider';
import {StyledMenu} from '../StyledMenu';
import {DarkMode} from './menuItems/DarkMode';
import {LightMode} from './menuItems/LightMode';
import {ShowTagCounts} from './menuItems/ShowTagCounts';

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

const memoizedViewMenu = React.memo(ViewMenu);

export {memoizedViewMenu as ViewMenu};
