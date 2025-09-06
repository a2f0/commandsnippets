import React from 'react';
import {useTranslation} from 'react-i18next';

import {MenuBarButton} from '../../MenuBarButton';

interface IProps {
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

const HelpMenuButton = ({onClick}: IProps) => {
  const {t} = useTranslation('menu');

  return (
    <MenuBarButton
      id="helpMenuButton"
      ariaControls="help-menu"
      ariaLabel={t('help')}
      onClick={onClick}
    >
      {t('help')}
    </MenuBarButton>
  );
};

const memoizedHelpMenuButton = React.memo(HelpMenuButton);
export {memoizedHelpMenuButton as HelpMenuButton};
