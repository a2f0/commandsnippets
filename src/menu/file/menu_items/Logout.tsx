import React from 'react';

import {tearleadsApi} from '../../../lib/api/tearleadsApi';
import {resetApplicationState} from '../../../lib/auth/authUtils';
import {StyledMenuItem} from '../../../StyledMenuItem';

interface IProps {
  onClose: () => void;
}

const Logout = ({onClose}: IProps) => {
  const handleLogout = () => {
    tearleadsApi
      .logout()
      .then(() => {
        resetApplicationState();
        onClose();
      })
      .catch((error: unknown) => {
        console.error('Logout error:', error);
      });
  };

  return (
    <StyledMenuItem id="file-menu-logout" onClick={handleLogout}>
      Logout
    </StyledMenuItem>
  );
};

const memoizedLogout = React.memo(Logout);
export {memoizedLogout as Logout};
