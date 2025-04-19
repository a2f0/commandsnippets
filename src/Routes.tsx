import React from 'react';
import {Route, Routes as ReactRouterRoutes} from 'react-router-dom';

import {useAppContext} from './AppContext';
import {GithubAuth} from './GithubAuth';
import GoogleAuth from './GoogleAuth';
import Main from './Main';
import PublicHomePage from './PublicHomePage';

const Routes = () => {
  const appConfig = useAppContext();

  return (
    <ReactRouterRoutes>
      <Route path="/oauth/github" element={<GithubAuth />} />
      <Route path="/oauth/google" element={<GoogleAuth />} />
      <Route path="/:user/:tag" element={<Main />} />
      <Route path="/:user" element={<Main />} />
      {appConfig.loggedInUser ? (
        <Route path="/" element={<Main />} />
      ) : (
        <Route path="/" element={<PublicHomePage />} />
      )}
    </ReactRouterRoutes>
  );
};

export default React.memo(Routes);
