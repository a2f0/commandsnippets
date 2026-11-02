import React from 'react';

import {useTypedTranslation} from '../../i18n/hooks';
import {DialogMenuItem} from '../DialogMenuItem';
import {StyledMenu} from '../StyledMenu';
import {AboutDialog} from './menuItems/AboutDialog';

interface IProps {
  onClose: () => void;
  anchorEl: HTMLElement | null;
}

const HelpMenu = ({onClose, anchorEl}: IProps) => {
  const {t} = useTypedTranslation('menu');
  return (
    <StyledMenu
      id="help-menu"
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
    >
      <DialogMenuItem
        id="about"
        label={t('about')}
        onClose={onClose}
        Dialog={AboutDialog}
      />
    </StyledMenu>
  );
};

const memoizedHelpMenu = React.memo(HelpMenu);

export {memoizedHelpMenu as HelpMenu};
