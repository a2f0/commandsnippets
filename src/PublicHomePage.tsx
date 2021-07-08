import GithubAuth from './GithubAuth';
import GoogleAuth from './GoogleAuth';
import React from 'react';

const PublicHomePage = () => {
  return (
    <div>
      <GithubAuth />
      <GoogleAuth />
    </div>
  );
};
export default React.memo(PublicHomePage);
