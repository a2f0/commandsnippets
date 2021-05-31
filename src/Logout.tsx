import React from 'react';
import {observer} from 'mobx-react';
import API from './api';
import {AxiosResponse} from 'axios';

const Logout: React.FunctionComponent = React.memo(
  observer(function Logout() {
    const handleLogout = () => {
      //const user = props.user;
      API.get('/api-token-deauth/', {withCredentials: true})
        .then(function (response: AxiosResponse<JSON>) {
          return response;
        })
        .then(() => {
          //user.userName = '';
        })
        .catch(err => console.error('Error:', err));
    };
    return <div onClick={handleLogout}>Logout</div>;
  })
);
export default Logout;
