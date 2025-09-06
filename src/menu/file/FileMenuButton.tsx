import React from 'react';
import {useTranslation} from 'react-i18next';

import {MenuBarButton} from '../../MenuBarButton';

interface IProps {
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

const FileMenuButton = ({onClick}: IProps) => {
  const {t} = useTranslation('menu');

  return (
    <MenuBarButton
      id="file-menu-button"
      ariaControls="file-menu"
      ariaLabel={t('file')}
      onClick={onClick}
    >
      {t('file')}
    </MenuBarButton>
  );
};

const memoizedFileMenuButton = React.memo(FileMenuButton);
export {memoizedFileMenuButton as FileMenuButton};
