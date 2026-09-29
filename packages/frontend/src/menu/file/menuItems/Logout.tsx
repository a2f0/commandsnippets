import React from 'react';

import {useTypedTranslation} from '../../../i18n/hooks';
import {signOut} from '../../../lib/state/appState';
import {StyledMenuItem} from '../../StyledMenuItem';

interface IProps {
  onClose: () => void;
}

const Logout = ({onClose}: IProps) => {
  const {t} = useTypedTranslation('common');

  const handleLogout = async () => {
    await signOut();
    onClose();
  };

  return (
    <StyledMenuItem id="file-menu-logout" onClick={handleLogout}>
      {t('logout')}
    </StyledMenuItem>
  );
};

const memoizedLogout = React.memo(Logout);

export {memoizedLogout as Logout};
