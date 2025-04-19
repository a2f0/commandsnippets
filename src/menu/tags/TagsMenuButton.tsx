import React from 'react';

import {MenuBarButton} from '../../MenuBarButton';

interface IProps {
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

const TagsMenuButton = ({onClick}: IProps) => (
  <MenuBarButton
    id="tags-menu-button"
    ariaControls="tags-menu"
    ariaLabel="Tags"
    onClick={onClick}
  >
    Tags
  </MenuBarButton>
);

const memoizedTagsMenuButton = React.memo(TagsMenuButton);
export {memoizedTagsMenuButton as TagsMenuButton};
