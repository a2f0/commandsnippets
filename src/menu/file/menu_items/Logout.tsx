import {AxiosResponse} from 'axios';
import axios from 'axios';
import React from 'react';

import {useAppContext} from '../../../AppContext';
import {baseHTTPURL} from '../../../lib/api/apiBase';
import {ILogoutJsonApiResponse} from '../../../lib/authentication';
import StyledMenuItem from '../../../StyledMenuItem';

interface IProps {
  onClose: () => void;
}

const Logout = function ({onClose}: IProps) {
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
        appConfig.setLoggedInUser(null);
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
