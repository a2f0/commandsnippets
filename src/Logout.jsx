import React from "react";
import {observer} from 'mobx-react';

@observer
class Logout extends React.Component { 

  constructor(props) {
    super(props);
    this.handleLogout = this.handleLogout.bind(this);
  }

  handleLogout(event) {
    const user = this.props.user;
    fetch('http://127.0.0.1:9001/api-token-deauth/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    }).then((response) => {
      return response.json();
    }).then((data) => {
      user.userName = '';
    }).catch(err => console.error("Error:", err));
    
  }

  render() {
    return (
      <div onClick={this.handleLogout}>
        Logout
      </div>
    )
  }
}

export default Logout;