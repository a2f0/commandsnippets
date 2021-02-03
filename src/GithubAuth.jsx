import React, { useEffect, useContext, createContext } from 'react'
import API from './api.js'
import AppContext from './AppContext.js'
import { makeStyles } from '@material-ui/core/styles';
import {observer} from 'mobx-react';
import { Github } from '@icons-pack/react-simple-icons';
import { useTheme } from '@material-ui/styles';

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
    cursor: 'pointer'
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
  const theme = useTheme();
  const appConfig = useContext(AppContext)
  const classes = useStyles()

  useEffect(() => {
    const queryString = window.location.search;
    // The callback adds oath/github to the current location.
    const is_github_oauth =   window.location.href.includes("oauth/github");
    const urlParams = new URLSearchParams(queryString);
    const code = urlParams.get('code')
    console.info('code (github auth): ' + code)
    console.info('is_github_oauth (github auth): ' + is_github_oauth)
    if (code !='' && is_github_oauth === true) {
      var newURL = window.location.protocol + "//" + window.location.host + "/"
      window.history.pushState({}, null, newURL);
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
        <div
          className={classes.loginBox}
          style={{color: theme.palette.text.primary}}
          onClick={handleGitHubClick}>

          <div className={classes.loginBoxIcon}>
            <Github
              style={{color: theme.palette.text.primary}}
              size={18} />
          </div>
          <div className={classes.loginBoxText}>
            Login with GitHub
          </div>
        </div>
      )}
    </>
  )
}))

export default GithubAuth;
