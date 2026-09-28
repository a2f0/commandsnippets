import React from 'react';
import {Routes as ReactRouterRoutes, Route} from 'react-router-dom';

import {useAppContext} from './AppContext';
import {AdminPage} from './components/admin_page/AdminPage';
import {SignInPage} from './components/sign_in_page/SignInPage';
import {GithubAuth} from './GithubAuth';
import {GoogleAuth} from './GoogleAuth';
import {Main} from './Main';
import {ADMIN_PATH, GITHUB_OAUTH_PATH, GOOGLE_OAUTH_PATH} from './routePaths';

const Routes = () => {
  const appConfig = useAppContext();

  return (
    <ReactRouterRoutes>
      <Route path={GITHUB_OAUTH_PATH} element={<GithubAuth />} />
      <Route path={GOOGLE_OAUTH_PATH} element={<GoogleAuth />} />
      <Route path={ADMIN_PATH} element={<AdminPage />} />
      <Route path="/:user/:tag" element={<Main />} />
      <Route path="/:user" element={<Main />} />
      {appConfig.loggedInUser ? (
        <Route path="/" element={<Main />} />
      ) : (
        <Route path="/" element={<SignInPage />} />
      )}
    </ReactRouterRoutes>
  );
};

const memoizedRoutes = React.memo(Routes);

export {memoizedRoutes as Routes};
