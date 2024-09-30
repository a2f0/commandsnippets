import React from 'react';

import MenuBarButton from '../../MenuBarButton';

interface IProps {
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

const TagsMenuButton = function ({onClick}: IProps) {
  return (
    <MenuBarButton
      id="tags-menu-button"
      ariaControls="tags-menu"
      ariaLabel="Tags"
      onClick={onClick}
    >
      Tags
    </MenuBarButton>
  );
};
export default React.memo(TagsMenuButton);
