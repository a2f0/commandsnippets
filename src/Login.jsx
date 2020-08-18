import React, { useContext, useState } from "react";
import Grid from '@material-ui/core/Grid';
import { baseHTTPURL } from './api.js' 
import axios from "axios";
import AppContext from './AppContext.js'
import { useHistory } from "react-router-dom";

const Login = React.memo(function Login() {

  const appConfig = useContext(AppContext)
  const [username, setUsername] = useState();
  const [password, setPassword] = useState();
  const history = useHistory();

  const handleAuthenticate = () => {
    const authenticate = async () => {
      const base_url = baseHTTPURL();
      const login_api = axios.create({
        baseURL: base_url,
        responseType: "json",
        headers: {
          'Content-Type': 'application/json'
        },
      });


      console.info("here")
      const payload = {
        "username": username,
        "password": password,
      }
      login_api.post('/api-token-auth/', payload, {withCredentials: true})
        .then(function (response) {
          // Login succeded
          appConfig.appStateStore.setLoggedInUser(username)
          setUsername(null)
          setPassword(null)
          history.push("/" + username);
        })
        .catch(function (error) {
          // Login failed
        })
        .then(function () {
          // always executed
        });
    }
    authenticate();
  }

  const handleUsernameChange = (event) => {
    setUsername(event.target.value);
  }

  const handlePasswordChange = (event) => {
    setPassword(event.target.value);
  }

  return (
    <Grid
      container
      spacing={0}
      direction="column"
      alignItems="center"
      justify="center"
      style={{ minHeight: '100vh' }}>
      <Grid item xs={3}>
        <form>
          <div>
            Username
          </div>
          <div>
            <input type="text" id="username" name="username" onChange={handleUsernameChange} autoComplete="username"></input>
          </div>
          <div>
            Password
          </div>
          <div>
            <input type="password" id="password" name="password" onChange={handlePasswordChange} autoComplete="current-password"></input>
          </div>
          <div>
            <div onClick={handleAuthenticate}>
              Login
            </div>
          </div>
        </form>
      </Grid>
    </Grid> 
  )


})

export default Login;