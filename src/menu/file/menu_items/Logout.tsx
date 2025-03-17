import type {AxiosResponse} from 'axios';
import axios from 'axios';
import {applySnapshot} from 'mobx-state-tree';
import React from 'react';

import {useAppContext} from '../../../AppContext';
import {baseHTTPURL} from '../../../lib/api/apiBase';
import type {ILogoutJsonApiResponse} from '../../../lib/authentication';
import {defaultState} from '../../../lib/shared';
import StyledMenuItem from '../../../StyledMenuItem';

interface IProps {
  onClose: () => void;
}

const Logout = ({onClose}: IProps) => {
  const appConfig = useAppContext();

  const handleLogout = () => {
    const base_url = baseHTTPURL;
    const logout_api = axios.create({
      baseURL: base_url,
      responseType: 'json',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    logout_api
      .post('/api-token-deauth/', {}, {withCredentials: true})
      .then((response: AxiosResponse<ILogoutJsonApiResponse>) => {
        applySnapshot(appConfig, defaultState);
        onClose();
        return response;
      });
  };

  return (
    <StyledMenuItem id="file-menu-logout" onClick={handleLogout}>
      Logout
    </StyledMenuItem>
  );
};

export default React.memo(Logout);
