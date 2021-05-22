import React from 'react';
import {observer} from 'mobx-react';
import API from './api.js';

const Logout = React.memo(
  observer(function Logout() {
    const handleLogout = () => {
      const user = this.props.user;
      API.get('/api-token-deauth/', {withCredentials: true})
        .then(function (response) {
          return response.json();
        })
        .then(() => {
          user.userName = '';
        })
        .catch(err => console.error('Error:', err));
    };
    return <div onClick={handleLogout}>Logout</div>;
  })
);
export default Logout;
