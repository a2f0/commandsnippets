import React from 'react';
import {Navigate, Routes as ReactRouterRoutes, Route} from 'react-router-dom';
import {GithubAuth} from './components/auth/GithubAuth';
import {GoogleAuth} from './components/auth/GoogleAuth';
import {useAppConfig} from './lib/state/appState';
import {AdminPage} from './pages/AdminPage';
import {EntriesPage} from './pages/EntriesPage';
import {SignInPage} from './pages/SignInPage';
import {ADMIN_PATH, GITHUB_OAUTH_PATH, GOOGLE_OAUTH_PATH} from './routePaths';

/**
 * The app's pages are for a signed-in user. Signed out — however that
 * happens: the menu, an expired session, cleared cookies, another tab — every
 * page but the OAuth callbacks goes to the sign-in page at `/`.
 */
const Routes = () => {
  const appConfig = useAppConfig();

  return (
    <ReactRouterRoutes>
      <Route path={GITHUB_OAUTH_PATH} element={<GithubAuth />} />
      <Route path={GOOGLE_OAUTH_PATH} element={<GoogleAuth />} />
      {appConfig.loggedInUser ? (
        <>
          <Route path={ADMIN_PATH} element={<AdminPage />} />
          <Route path="/:user/:tag" element={<EntriesPage />} />
          <Route path="/:user" element={<EntriesPage />} />
          <Route path="/" element={<EntriesPage />} />
        </>
      ) : (
        <>
          <Route path="/" element={<SignInPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </>
      )}
    </ReactRouterRoutes>
  );
};

const memoizedRoutes = React.memo(Routes);

export {memoizedRoutes as Routes};
