import React, {useEffect, useRef} from 'react';
import {
  Navigate,
  Routes as ReactRouterRoutes,
  Route,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import {GithubAuth} from './components/auth/GithubAuth';
import {GoogleAuth} from './components/auth/GoogleAuth';
import {useAppConfig} from './lib/state/appState';
import {AdminPage} from './pages/AdminPage';
import {EntriesPage} from './pages/EntriesPage';
import {SignInPage} from './pages/SignInPage';
import {ADMIN_PATH, GITHUB_OAUTH_PATH, GOOGLE_OAUTH_PATH} from './routePaths';

/**
 * User URLs are public read-only views for guests. The root and admin page
 * require a signed-in user; OAuth callbacks remain available to everyone.
 */
const Routes = () => {
  const appConfig = useAppConfig();
  const username = appConfig.loggedInUser;
  const previousUser = useRef(username);
  const navigate = useNavigate();
  const {pathname} = useLocation();
  useEffect(() => {
    const previous = previousUser.current;
    previousUser.current = username;
    // A session ending or switching still leaves the previous user's page.
    // Guests opening a public URL directly have no session transition.
    if (
      previous !== null &&
      previous !== username &&
      (username === null || pathname !== ADMIN_PATH)
    )
      navigate(username === null ? '/' : `/${username}`, {replace: true});
  }, [username, pathname, navigate]);

  return (
    <ReactRouterRoutes>
      <Route path={GITHUB_OAUTH_PATH} element={<GithubAuth />} />
      <Route path={GOOGLE_OAUTH_PATH} element={<GoogleAuth />} />
      <Route
        path={ADMIN_PATH}
        element={
          appConfig.loggedInUser ? <AdminPage /> : <Navigate to="/" replace />
        }
      />
      <Route path="/:user/:tag" element={<EntriesPage />} />
      <Route path="/:user" element={<EntriesPage />} />
      {appConfig.loggedInUser ? (
        <Route path="/" element={<EntriesPage />} />
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
