import MenuBarButton from '../../MenuBarButton';
import React from 'react';

interface IProps {
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

const FileMenuButton = function ({onClick}: IProps) {
  return (
    <MenuBarButton
      id="file-menu-button"
      ariaControls="file-menu"
      ariaLabel="File"
      onClick={onClick}
    >
      File
    </MenuBarButton>
  );
};
export default React.memo(FileMenuButton);
