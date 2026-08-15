import React from 'react';
import {useTypedTranslation} from '../../i18n/hooks';

import {MenuBarButton} from '../../MenuBarButton';

interface IProps {
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

const TagsMenuButton = ({onClick}: IProps) => {
  const {t} = useTypedTranslation('menu');

  return (
    <MenuBarButton
      id="tags-menu-button"
      ariaControls="tags-menu"
      ariaLabel={t('tags')}
      onClick={onClick}
    >
      {t('tags')}
    </MenuBarButton>
  );
};

const memoizedTagsMenuButton = React.memo(TagsMenuButton);
export {memoizedTagsMenuButton as TagsMenuButton};
