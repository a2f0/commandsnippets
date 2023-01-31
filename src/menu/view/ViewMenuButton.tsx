import MenuBarButton from '../../MenuBarButton';
import React from 'react';

interface IProps {
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

const ViewMenuButton = function ({onClick}: IProps) {
  return (
    <MenuBarButton
      id="view-menu-button"
      ariaControls="view-menu"
      ariaLabel="View"
      onClick={onClick}
    >
      View
    </MenuBarButton>
  );
};
export default React.memo(ViewMenuButton);
