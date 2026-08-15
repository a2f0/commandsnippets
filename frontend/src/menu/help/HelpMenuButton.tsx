import React from 'react';
import {useTypedTranslation} from '../../i18n/hooks';

import {MenuBarButton} from '../../MenuBarButton';

interface IProps {
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

const HelpMenuButton = ({onClick}: IProps) => {
  const {t} = useTypedTranslation('menu');

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
