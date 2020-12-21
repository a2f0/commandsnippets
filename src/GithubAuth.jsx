import React, { useEffect, useContext, createContext } from 'react'
import API from './api.js' 
import AppContext from './AppContext.js'
import { makeStyles } from '@material-ui/core/styles';
import {observer} from 'mobx-react';

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
              appConfig.appStateStore.setLoggedInUser(response.data.data.attributes.username)
            })
        })
        .catch(function (error) {
          appConfig.appStateStore.setLoggedInUser('')
        })
        .then(function () {
        });
    }

  }, [])

  return (
    <>
      { appConfig.appStateStore.loggedInUser && (
        <div className={classes.clickableDiv}>{appConfig.appStateStore.loggedInUser}</div>
      )}

      { ! appConfig.appStateStore.loggedInUser && (
        <div>
          <a href={`https://github.com/login/oauth/authorize?scope=user:email&client_id=` + githubClientID() }>Github</a>
        </div>
      )}
    </>
  )
}))

export default GithubAuth;