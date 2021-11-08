import AppBar from '@mui/material/AppBar';
import GithubAuth from './GithubAuth';
import GoogleAuth from './GoogleAuth';
import {Grid} from '@mui/material';
import React from 'react';
import StyledToolbar from './styled/layout/StyledToolbar';

const PublicHomePage = () => {
  return (
    <AppBar position="fixed">
      <StyledToolbar>
        <Grid container justifyContent="flex-end">
          <GithubAuth />
          <GoogleAuth />
        </Grid>
      </StyledToolbar>
    </AppBar>
  );
};
export default React.memo(PublicHomePage);
