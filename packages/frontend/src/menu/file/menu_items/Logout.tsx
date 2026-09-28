import React from 'react';

import {useTypedTranslation} from '../../../i18n/hooks';
import {tearleadsApi} from '../../../lib/api/tearleadsApi';
import {resetApplicationState} from '../../../lib/store/store';
import {StyledMenuItem} from '../../../StyledMenuItem';

interface IProps {
  onClose: () => void;
}

const Logout = ({onClose}: IProps) => {
  const {t} = useTypedTranslation('common');

  const handleLogout = async () => {
    try {
      await tearleadsApi.logout();
    } catch (error: unknown) {
      console.error('Logout error:', error);
    } finally {
      resetApplicationState();
      onClose();
    }
  };

  return (
    <StyledMenuItem id="file-menu-logout" onClick={handleLogout}>
      {t('logout')}
    </StyledMenuItem>
  );
};

const memoizedLogout = React.memo(Logout);

export {memoizedLogout as Logout};
