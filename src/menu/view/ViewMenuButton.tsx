import React from 'react';

import {MenuBarButton} from '../../MenuBarButton';

interface IProps {
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

const ViewMenuButton = ({onClick}: IProps) => (
  <MenuBarButton
    id="view-menu-button"
    ariaControls="view-menu"
    ariaLabel="View"
    onClick={onClick}
  >
    View
  </MenuBarButton>
);

const memoizedViewMenuButton = React.memo(ViewMenuButton);
export {memoizedViewMenuButton as ViewMenuButton};
