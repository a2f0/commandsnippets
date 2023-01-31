import MenuBarButton from '../../MenuBarButton';
import React from 'react';

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
