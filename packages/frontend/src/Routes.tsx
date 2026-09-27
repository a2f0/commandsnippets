import React from 'react';
import {Routes as ReactRouterRoutes, Route} from 'react-router-dom';

import {useAppContext} from './AppContext';
import {SignInPage} from './components/sign_in_page/SignInPage';
import {GithubAuth} from './GithubAuth';
import {GoogleAuth} from './GoogleAuth';
import {Main} from './Main';

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
        <Route path="/" element={<SignInPage />} />
      )}
    </ReactRouterRoutes>
  );
};

const memoizedRoutes = React.memo(Routes);

export {memoizedRoutes as Routes};
