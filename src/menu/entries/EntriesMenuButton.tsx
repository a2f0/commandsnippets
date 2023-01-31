import MenuBarButton from '../../MenuBarButton';
import React from 'react';

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
