import {applySnapshot} from 'mobx-state-tree';
import React from 'react';

import {useAppContext} from '../../../AppContext';
import {
  ApiError,
  type ApiResponse,
  baseHTTPURL,
  FetchApiClient,
} from '../../../lib/api/fetchBase';
import type {ILogoutJsonApiResponse} from '../../../lib/authentication';
import {defaultState} from '../../../lib/shared';
import {StyledMenuItem} from '../../../StyledMenuItem';

interface IProps {
  onClose: () => void;
}

const Logout = ({onClose}: IProps) => {
  const appConfig = useAppContext();

  const handleLogout = () => {
    const logout_api = new FetchApiClient({
      baseURL: baseHTTPURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    logout_api
      .post<ILogoutJsonApiResponse>(
        '/api-token-deauth/',
        {},
        {withCredentials: true}
      )
      .then((response: ApiResponse<ILogoutJsonApiResponse>) => {
        applySnapshot(appConfig, defaultState);
        onClose();
        return response;
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError) {
          console.error(`Logout failed: ${error.message}`, error);
        } else {
          console.error('Unexpected error during logout:', error);
        }
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
