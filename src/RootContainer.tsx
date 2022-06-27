import {Route, Routes} from 'react-router-dom';
import GithubAuth from './GithubAuth';
import GoogleAuth from './GoogleAuth';
import Main from './Main';
import PublicHomePage from './PublicHomePage';
import React from 'react';
import {styled} from '@mui/material/styles';
import {useAppContext} from './AppContext';

const Wrapper = styled('div')(() => ({
  display: 'flex',
}));

const RootContainer = () => {
  const appConfig = useAppContext();

  return (
    <Wrapper id="root-container">
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
    </Wrapper>
  );
};

export default React.memo(RootContainer);
