import {applySnapshot} from 'mobx-state-tree';
import React from 'react';

import {useAppContext} from '../../../AppContext';
import {tearleadsApi} from '../../../lib/api/tearleadsApi';
import {defaultState} from '../../../lib/shared';
import {StyledMenuItem} from '../../../StyledMenuItem';

interface IProps {
  onClose: () => void;
}

const Logout = ({onClose}: IProps) => {
  const appConfig = useAppContext();

  const handleLogout = () => {
    tearleadsApi
      .logout()
      .then(() => {
        applySnapshot(appConfig, defaultState);
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
