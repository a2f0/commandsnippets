import React, {useEffect} from 'react';
import API from './api';
import {Google} from '@icons-pack/react-simple-icons';
import {Theme} from '@material-ui/core/styles';
import {makeStyles} from '@material-ui/core/styles';
import {observer} from 'mobx-react';
import {useAppContext} from './AppContext';
import {useTheme} from '@material-ui/styles';

export const googleClientID = () => {
  if (window.location.hostname === 'staging.tearleads.com') {
    return '424258972420-jcqddba6bu3942ertk3nr7p6lc9e6b6h.apps.googleusercontent.com';
  } else if (window.location.hostname === 'tearleads.com') {
    return '424258972420-jcqddba6bu3942ertk3nr7p6lc9e6b6h.apps.googleusercontent.com';
  } else {
    return '424258972420-jcqddba6bu3942ertk3nr7p6lc9e6b6h.apps.googleusercontent.com';
  }
};

export const redirectUrl = () => {
  console.info(
    'window.location.hostname (redirectUrl): ' + window.location.hostname
  );
  if (window.location.hostname === 'staging.tearleads.com') {
    console.info('returning https%3A//staging.tearleads.com');
    return 'https%3A//staging.tearleads.com';
  } else if (window.location.hostname === 'tearleads.com') {
    console.info('returning https%3A//tearleads.com');
    return 'https%3A//tearleads.com';
  } else {
    console.info('returning http%3A//localhost:8080');
    return 'http%3A//localhost:8080';
  }
};

const useStyles = makeStyles({
  clickableDiv: {
    marginRight: '10px',
    cursor: 'pointer',
  },
  loginBox: {
    width: '150px',
    cursor: 'pointer',
  },
  loginBoxIcon: {
    textAlign: 'center',
    display: 'inline-block',
  },
  loginBoxText: {
    marginLeft: '5px',
    textAlign: 'center',
    display: 'inline-block',
  },
});

const GoogleAuth = () => {
  const theme = useTheme<Theme>();
  const appConfig = useAppContext();
  const classes = useStyles();

  useEffect(() => {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const code = urlParams.get('code');
    const scope = urlParams.get('scope');
    console.info('code (google auth): ' + code);
    console.info('scope (google auth): ' + scope);
    if (
      code !== '' &&
      scope !== null &&
      scope.includes('https://www.googleapis.com/auth/userinfo.email')
    ) {
      const newURL =
        window.location.protocol + '//' + window.location.host + '/';
      window.history.pushState({}, '', newURL);
      const payload = {
        data: {
          type: 'GoogleLogin',
          attributes: {
            code: code,
          },
        },
      };
      API.post('/google-login/', payload, {withCredentials: true})
        .then(() => {
          API.get('/user/', {withCredentials: true}).then(response => {
            const username = response.data.data.attributes.username;
            appConfig.setLoggedInUser(username);
            document.cookie = 'loggedInUser=' + username;
          });
        })
        .catch(() => {
          appConfig.setLoggedInUser('');
        })
        .then(() => {});
    }
  }, []);

  const handleGitHubClick = () => {
    const redirect = redirectUrl();
    console.info('window.location.hostname: ' + window.location.hostname);
    console.info('redirect: ' + redirect);
    window.location.assign(
      'https://accounts.google.com/o/oauth2/v2/auth?scope=https%3A//www.googleapis.com/auth/userinfo.email&access_type=offline&include_granted_scopes=true&response_type=code&state=state_parameter_passthrough_value&redirect_uri=' +
        redirect +
        '&client_id=' +
        googleClientID()
    );
  };

  return (
    <>
      {appConfig.loggedInUser && (
        <div className={classes.clickableDiv}>{appConfig.loggedInUser}</div>
      )}

      {!appConfig.loggedInUser && (
        <div
          className={classes.loginBox}
          style={{color: theme.palette.text.primary}}
          onClick={handleGitHubClick}
        >
          <div className={classes.loginBoxIcon}>
            <Google style={{color: theme.palette.text.primary}} size={18} />
          </div>
          <div className={classes.loginBoxText}>Login with Google</div>
        </div>
      )}
    </>
  );
};

export default React.memo(observer(GoogleAuth));
