import React from 'react';
import {useTypedTranslation} from '../../i18n/hooks';

import {MenuBarButton} from '../MenuBarButton';

interface IProps {
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

const DebugMenuButton = ({onClick}: IProps) => {
  const {t} = useTypedTranslation('menu');

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
