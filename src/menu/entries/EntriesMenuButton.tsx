import React from 'react';

import MenuBarButton from '../../MenuBarButton';

interface IProps {
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

const EntriesMenuButton = function ({onClick}: IProps) {
  return (
    <MenuBarButton
      id="entries-menu-button"
      ariaControls="entries-menu"
      ariaLabel="Entries"
      onClick={onClick}
    >
      Entries
    </MenuBarButton>
  );
};
export default React.memo(EntriesMenuButton);
