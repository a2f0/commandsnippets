import {AxiosResponse} from 'axios';
import {ILogoutJsonApiResponse} from '../../../lib/authentication';
import React from 'react';
import StyledMenuItem from '../../../StyledMenuItem';
import axios from 'axios';
import {baseHTTPURL} from '../../../apiBase';
import {useAppContext} from '../../../AppContext';

interface IProps {
  onClose: () => void;
}

const Logout = function ({onClose}: IProps) {
  const appConfig = useAppContext();

  const handleLogout = () => {
    const base_url = baseHTTPURL();
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
      })
      .catch(() => {})
      .then(() => {});
  };

  return (
    <StyledMenuItem id="file-menu-logout" onClick={handleLogout}>
      Logout
    </StyledMenuItem>
  );
};

export default React.memo(Logout);
