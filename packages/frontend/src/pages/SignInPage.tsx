import {Box, Typography} from '@mui/material';
import React from 'react';

import {GithubAuth} from '../components/auth/GithubAuth';
import {GoogleAuth} from '../components/auth/GoogleAuth';

/** What a signed-out visitor sees; the marketing site is packages/website. */
const SignInPage = () => {
  return (
    <Box
      id="signInPage"
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        backgroundColor: theme => theme.palette.background.default,
      }}
    >
      <Typography
        variant="h4"
        component="h1"
        sx={{color: theme => theme.palette.text.primary}}
      >
        Login to Continue
      </Typography>
      <Box sx={{display: 'flex', gap: 1}}>
        <GithubAuth />
        <GoogleAuth />
      </Box>
    </Box>
  );
};

const memoizedSignInPage = React.memo(SignInPage);

export {memoizedSignInPage as SignInPage};
