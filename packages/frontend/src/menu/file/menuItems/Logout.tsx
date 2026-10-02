import React from 'react';

import {useTypedTranslation} from '../../../i18n/hooks';
import {requestSignOut} from '../../../lib/state/signOutWarning';
import {StyledMenuItem} from '../../StyledMenuItem';

interface IProps {
  onClose: () => void;
}

const Logout = ({onClose}: IProps) => {
  const {t} = useTypedTranslation('common');

  const handleLogout = async () => {
    onClose();
    await requestSignOut();
  };

  return (
    <StyledMenuItem id="file-menu-logout" onClick={handleLogout}>
      {t('logout')}
    </StyledMenuItem>
  );
};

const memoizedLogout = React.memo(Logout);

export {memoizedLogout as Logout};
