import React from 'react';
import {useTypedTranslation} from '../../i18n/hooks';

import {MenuBarButton} from '../../MenuBarButton';

interface IProps {
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

const ViewMenuButton = ({onClick}: IProps) => {
  const {t} = useTypedTranslation('menu');

  return (
    <MenuBarButton
      id="view-menu-button"
      ariaControls="view-menu"
      ariaLabel={t('view')}
      onClick={onClick}
    >
      {t('view')}
    </MenuBarButton>
  );
};

const memoizedViewMenuButton = React.memo(ViewMenuButton);

export {memoizedViewMenuButton as ViewMenuButton};
