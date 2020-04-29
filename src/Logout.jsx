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
    const { cookies } = this.props;
    cookies.remove('token', { path: '/' });
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