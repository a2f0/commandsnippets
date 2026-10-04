import React, {useEffect, useRef} from 'react';
import {GithubAuth} from './components/auth/GithubAuth';
import {GoogleAuth} from './components/auth/GoogleAuth';
import {currentRoute, navigate, useRoute} from './lib/router/navigation';
import {Navigate} from './lib/router/Router';
import {useAppConfig} from './lib/state/appState';
import {AdminPage} from './pages/AdminPage';
import {EntriesPage} from './pages/EntriesPage';
import {SignInPage} from './pages/SignInPage';

/**
 * User URLs are public read-only views for guests. The root and admin page
 * require a signed-in user; OAuth callbacks remain available to everyone.
 * The page renders again only when the route goes to another page (`page`),
 * not when its parameters change (another tag).
 */
const Routes = () => {
  const appConfig = useAppConfig();
  const username = appConfig.loggedInUser;
  const previousUser = useRef(username);
  const page = useRoute(route => route.page);
  useEffect(() => {
    const previous = previousUser.current;
    previousUser.current = username;
    // A session ending or switching still leaves the previous user's page.
    // Guests opening a public URL directly have no session transition.
    if (
      previous !== null &&
      previous !== username &&
      (username === null || currentRoute().page !== 'admin')
    )
      navigate(username === null ? '/' : `/${username}`, {replace: true});
  }, [username]);

  switch (page) {
    case 'githubOAuth':
      return <GithubAuth />;
    case 'googleOAuth':
      return <GoogleAuth />;
    case 'admin':
      return username ? <AdminPage /> : <Navigate to="/" replace />;
    case 'user':
      return <EntriesPage />;
    case 'root':
      // The same page as a user's (`/:user`), which it goes on to.
      return username ? <EntriesPage /> : <SignInPage />;
    case 'none':
      return username ? null : <Navigate to="/" replace />;
  }
};

const memoizedRoutes = React.memo(Routes);

export {memoizedRoutes as Routes};
