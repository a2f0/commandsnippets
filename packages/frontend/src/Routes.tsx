import React from 'react';
import {Routes as ReactRouterRoutes, Route} from 'react-router-dom';
import {GithubAuth} from './components/auth/GithubAuth';
import {GoogleAuth} from './components/auth/GoogleAuth';
import {useAppConfig} from './lib/state/appState';
import {AdminPage} from './pages/AdminPage';
import {EntriesPage} from './pages/EntriesPage';
import {SignInPage} from './pages/SignInPage';
import {ADMIN_PATH, GITHUB_OAUTH_PATH, GOOGLE_OAUTH_PATH} from './routePaths';

const Routes = () => {
  const appConfig = useAppConfig();

  return (
    <ReactRouterRoutes>
      <Route path={GITHUB_OAUTH_PATH} element={<GithubAuth />} />
      <Route path={GOOGLE_OAUTH_PATH} element={<GoogleAuth />} />
      <Route path={ADMIN_PATH} element={<AdminPage />} />
      <Route path="/:user/:tag" element={<EntriesPage />} />
      <Route path="/:user" element={<EntriesPage />} />
      {appConfig.loggedInUser ? (
        <Route path="/" element={<EntriesPage />} />
      ) : (
        <Route path="/" element={<SignInPage />} />
      )}
    </ReactRouterRoutes>
  );
};

const memoizedRoutes = React.memo(Routes);

export {memoizedRoutes as Routes};
