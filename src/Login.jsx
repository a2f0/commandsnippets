import React from "react";
import { instanceOf } from 'prop-types';
import { withCookies, Cookies } from 'react-cookie';
class Login extends React.Component { 
  static propTypes = {
    cookies: instanceOf(Cookies).isRequired
  };

  constructor(props) {
    super(props);
    const { cookies } = props;
    this.state = {
      username: '',
      password: '',
      token: cookies.get('token') || ''
    };
    this.handleUsernameChange = this.handleUsernameChange.bind(this);
    this.handlePasswordChange = this.handlePasswordChange.bind(this);
  }

  authenticate() {
    const payload = {
      "username": this.state.username,
      "password": this.state.password,
    }
    fetch('http://127.0.0.1:9001/api-token-auth/', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    }).then((response) => {
      if (response.status === 200) {
        // Successful authentication
      }
    }).then((data) => {
    }).catch(err => console.error("Error:", err));
  }

  handleUsernameChange(event) {
    this.setState({username: event.target.value});
  }

  handlePasswordChange(event) {
    this.setState({password: event.target.value});
  }

  render() {
    return (
      <div className="flex-center-column">
        <div className="flex-align-center">
          <div className="login-box">
            <div>
              Username
            </div>
            <div>
              <input type="text" id="username" name="username" value={this.state.username} onChange={this.handleUsernameChange}></input>
            </div>
            <div>
              Password
            </div>
            <div>
              <input type="password" id="password" name="password"  value={this.state.password} onChange={this.handlePasswordChange}></input>
            </div>
            <div>
              <div className="create-entry-button" onClick={() => this.authenticate()}>
                Login
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
}

export default withCookies(Login);