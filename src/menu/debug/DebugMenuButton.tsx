import React from 'react';

import MenuBarButton from '../../MenuBarButton';

interface IProps {
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

const DebugMenuButton = function ({onClick}: IProps) {
  return (
    <MenuBarButton
      id="debug-menu-button"
      ariaControls="debug-menu"
      ariaLabel="Debug"
      onClick={onClick}
    >
      Debug
    </MenuBarButton>
  );
};
export default React.memo(DebugMenuButton);
