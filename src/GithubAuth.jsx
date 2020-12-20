import React, { useEffect, useContext, createContext } from 'react'
import API from './api.js' 
import AppContext from './AppContext.js'
import { makeStyles } from '@material-ui/core/styles';
import {observer} from 'mobx-react';

export const githubClientID = () => {
  if (window.location.hostname === 'staging.tearleads.com') {
    return '48c3fe5bbaba3afe2cdc';
  } else if (window.location.hostname === 'tearleads.com') {
    return 'e6d68d0827ef6c54e4a3';
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
          // This function parses document.cookie.
          const x = document.cookie
            .split(';')
            .reduce((res, c) => {
              const [key, val] = c.trim().split('=').map(decodeURIComponent)
              try {
                return Object.assign(res, { [key]: JSON.parse(val) })
              } catch (e) {
                return Object.assign(res, { [key]: val })
              }
            }, {});
          appConfig.appStateStore.setLoggedInUser(x.LoggedInUser)
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