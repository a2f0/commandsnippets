import React from "react";
import { instanceOf } from 'prop-types';
import { withCookies, Cookies } from 'react-cookie';
class Logout extends React.Component { 
  
  static propTypes = {
    cookies: instanceOf(Cookies).isRequired
  };

  constructor(props) {
    super(props);
    const { cookies } = props;
    this.state = {
      token: cookies.get('token') || ''
    };
    this.handleLogout = this.handleLogout.bind(this);
  }

  handleLogout(event) {
    fetch('http://127.0.0.1:9001/api-token-deauth/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    }).then((response) => {
      return response.json();
    }).then((data) => {
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

export default withCookies(Logout);