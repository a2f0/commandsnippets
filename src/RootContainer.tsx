import {Route, Routes} from 'react-router-dom';
import GithubAuth from './GithubAuth';
import GoogleAuth from './GoogleAuth';
import Main from './Main';
import PublicHomePage from './PublicHomePage';
import React from 'react';
import makeStyles from '@mui/styles/makeStyles';
import {useAppContext} from './AppContext';

const useStyles = makeStyles({
  root: {
    display: 'flex',
  },
});

const RootContainer = () => {
  const appConfig = useAppContext();
  const classes = useStyles();

  return (
    <div className={classes.root} id="root-container">
      <Routes>
        <Route path="/oauth/github" element={<GithubAuth />} />
        <Route path="/oauth/google" element={<GoogleAuth />} />
        <Route path="/:user/:tag" element={<Main />} />
        <Route path="/:user" element={<Main />} />
        {appConfig.loggedInUser ? (
          <Route path="/" element={<Main />} />
        ) : (
          <Route path="/" element={<PublicHomePage />} />
        )}
      </Routes>
    </div>
  );
};

export default React.memo(RootContainer);
