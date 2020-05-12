import React from "react";
import { observer } from 'mobx-react';
import { Redirect } from 'react-router-dom';
import constructApiUrl from './api.mjs';

@observer
class Login extends React.Component { 

  constructor(props) {
    super(props);
    this.state = {
      username: '',
      password: '',
    };
    this.handleUsernameChange = this.handleUsernameChange.bind(this);
    this.handlePasswordChange = this.handlePasswordChange.bind(this);
  }

  handleAuthenticate() {
    const user = this.props.user;
    const payload = {
      "username": this.state.username,
      "password": this.state.password,
    }
    const base_url = constructApiUrl();
    const url = base_url + '/api-token-auth/';
    fetch(url, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    }).then((response) => {
      if (response.status === 200) {
        // Successful authentication
        user.userName=this.state.username;
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
    const user = this.props.user;
    if(user.userName!='') {
      return (
        // https://blog.bitsrc.io/must-know-concepts-of-react-router-fb9c8cc3c12
        <Redirect to="/"/>
      )
    }
    return (
      <div className="flex-center-column">
        <div className="flex-align-center">
          <div className="login-box">
            <form>
              <div>
                Username
              </div>
              <div>
                <input type="text" id="username" name="username" value={this.state.username} onChange={this.handleUsernameChange} autoComplete="username"></input>
              </div>
              <div>
                Password
              </div>
              <div>
                <input type="password" id="password" name="password"  value={this.state.password} onChange={this.handlePasswordChange} autoComplete="current-password"></input>
              </div>
              <div>
                <div className="create-entry-button" onClick={() => this.handleAuthenticate()}>
                  Login
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    )
  }
}

export default Login;