import React from 'react';
import {observer} from 'mobx-react';
import constructApiUrl from './api.mjs';

@observer
class Logout extends React.Component {
  constructor(props) {
    super(props);
    this.handleLogout = this.handleLogout.bind(this);
  }

  handleLogout() {
    const user = this.props.user;
    const base_url = constructApiUrl();
    const url = base_url + '/api-token-deauth/';
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    })
      .then(response => {
        return response.json();
      })
      .then(data => {
        user.userName = '';
      })
      .catch(err => console.error('Error:', err));
  }

  render() {
    return <div onClick={this.handleLogout}>Logout</div>;
  }
}

export default Logout;
