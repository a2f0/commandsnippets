import {Route, Routes} from 'react-router-dom';
import GithubAuth from './GithubAuth';
import GoogleAuth from './GoogleAuth';
import Main from './Main';
import PublicHomePage from './PublicHomePage';
import React from 'react';
import {useAppContext} from './AppContext';

const RootContainer = () => {
  const appConfig = useAppContext();

  return (
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
  );
};

export default React.memo(RootContainer);
