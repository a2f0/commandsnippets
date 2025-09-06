import React from 'react';
import {useTypedTranslation} from '../../i18n/hooks';

import {MenuBarButton} from '../../MenuBarButton';

interface IProps {
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

const EntriesMenuButton = ({onClick}: IProps) => {
  const {t} = useTypedTranslation('menu');

  return (
    <MenuBarButton
      id="entries-menu-button"
      ariaControls="entries-menu"
      ariaLabel={t('entries')}
      onClick={onClick}
    >
      {t('entries')}
    </MenuBarButton>
  );
};

const memoizedEntriesMenuButton = React.memo(EntriesMenuButton);
export {memoizedEntriesMenuButton as EntriesMenuButton};
