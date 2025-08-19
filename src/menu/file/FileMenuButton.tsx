import React from 'react';

import {MenuBarButton} from '../../MenuBarButton';

interface IProps {
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

const FileMenuButton = ({onClick}: IProps) => (
  <MenuBarButton
    id="file-menu-button"
    ariaControls="file-menu"
    ariaLabel="File"
    onClick={onClick}
  >
    File
  </MenuBarButton>
);

const memoizedFileMenuButton = React.memo(FileMenuButton);
export {memoizedFileMenuButton as FileMenuButton};
