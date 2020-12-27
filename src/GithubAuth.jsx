import React, { useEffect, useContext, createContext } from 'react'
import API from './api.js' 
import AppContext from './AppContext.js'
import { makeStyles } from '@material-ui/core/styles';
import {observer} from 'mobx-react';
import { Github } from '@icons-pack/react-simple-icons';

export const githubClientID = () => {
  if (window.location.hostname === 'staging.tearleads.com') {
    return '3be8b14684de28d54a0d';
  } else if (window.location.hostname === 'tearleads.com') {
    return 'a3cf7c1dfabc3df68b06';
  } else {
    return "a94dc4b2bb6ed4fc63a0";
  }
}

const useStyles = makeStyles((theme) => ({
  clickableDiv: {
    marginRight: '10px',
    cursor: 'pointer'
  },
  loginBox: {
    width: '150px',
    position: 'fixed',
    top: '15px',
    right: '8px',
  },
  loginBoxIcon: {
    textAlign: 'center',
    display: 'inline-block'
  },
  loginBoxText: {
    marginLeft: '5px',
    textAlign: 'center',
    display: 'inline-block'
  }
}));

const GithubAuth = React.memo(observer(function GithubAuth() {

  const appConfig = useContext(AppContext)
  const classes = useStyles()

  useEffect(() => {
    const url = window.location.href;
    const hasCode = url.includes("?code=");
    if (hasCode) {
      const newUrl = url.split("?code=");
      const code = newUrl[1]
      window.history.pushState({}, null, newUrl[0]);
      const payload = {
        data: {
          type: "GithubLogin",
          attributes: {
            code: code
          }
        },
      };
      API.post('/github-login/', payload, {withCredentials: true})
        .then(function (response) {
          API.get('/user/', {withCredentials: true})
            .then(function (response) {            
              const username = response.data.data.attributes.username
              appConfig.appStateStore.setLoggedInUser(username)
              document.cookie = "loggedInUser=" + username;
            })
        })
        .catch(function (error) {
          appConfig.appStateStore.setLoggedInUser('')
        })
        .then(function () {
        });
    }

  }, [])

  const handleGitHubClick = () => {
    window.location.assign('https://github.com/login/oauth/authorize?scope=user:email&client_id=' + githubClientID());
  }

  return (
    <>
      { appConfig.appStateStore.loggedInUser && (
        <div className={classes.clickableDiv}>{appConfig.appStateStore.loggedInUser}</div>
      )}

      { ! appConfig.appStateStore.loggedInUser && (
        <div className={classes.loginBox}>

          <div className={classes.loginBoxIcon}>
            <Github color="#FFFFFF" size={18} />
          </div>
          <div className={classes.loginBoxText} onClick={handleGitHubClick}>
            Login with GitHub
          </div>
        </div>
      )}
    </>
  )
}))

export default GithubAuth;