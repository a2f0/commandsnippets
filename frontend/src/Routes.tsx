import React from 'react';
import {Routes as ReactRouterRoutes, Route} from 'react-router-dom';

import {useAppContext} from './AppContext';
import {PublicHomePage} from './components/public_home_page/PublicHomePage';
import {GithubAuth} from './GithubAuth';
import {GoogleAuthWrapper} from './GoogleAuthWrapper';
import {Main} from './Main';

const Routes = () => {
  const appConfig = useAppContext();

  return (
    <ReactRouterRoutes>
      <Route path="/oauth/github" element={<GithubAuth />} />
      <Route path="/oauth/google" element={<GoogleAuthWrapper />} />
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

const memoizedRoutes = React.memo(Routes);

export {memoizedRoutes as Routes};
