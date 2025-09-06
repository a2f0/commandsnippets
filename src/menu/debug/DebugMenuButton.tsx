import React from 'react';
import {useTranslation} from 'react-i18next';

import {MenuBarButton} from '../../MenuBarButton';

interface IProps {
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

const DebugMenuButton = ({onClick}: IProps) => {
  const {t} = useTranslation('menu');

  return (
    <MenuBarButton
      id="debug-menu-button"
      ariaControls="debug-menu"
      ariaLabel={t('debug')}
      onClick={onClick}
    >
      {t('debug')}
    </MenuBarButton>
  );
};

const memoizedDebugMenuButton = React.memo(DebugMenuButton);
export {memoizedDebugMenuButton as DebugMenuButton};
