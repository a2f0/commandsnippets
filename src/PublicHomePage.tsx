import * as Constants from './constants';
import AppBar from '@mui/material/AppBar';
import GithubAuth from './GithubAuth';
import GoogleAuth from './GoogleAuth';
import {Grid} from '@mui/material';
import React from 'react';
import StyledToolbar from './styled/layout/StyledToolbar';

const PublicHomePage = () => {
  return (
    <>
      <AppBar
        position="fixed"
        sx={{
          height: `${Constants.appBarHeight}px`,
          boxShadow: 'none', // Remove the Material UI 'bottom border'.
          backgroundImage: 'none', // Remove the Material UI gradient.
          borderBottom: '1px solid #808080',
          backgroundColor: theme => `${theme.header.background}`,
        }}
      >
        <StyledToolbar>
          <Grid container justifyContent="flex-end">
            <GithubAuth />
            <GoogleAuth />
          </Grid>
        </StyledToolbar>
      </AppBar>
      <Grid
        container
        sx={{
          paddingTop: `${Constants.appBarHeight}px`,
        }}
      >
        <Grid
          item
          xs={12}
          sx={{
            marginTop: '250px',
            fontSize: '64px',
            textAlign: 'center',
            color: theme => `${theme.palette.text.primary}`,
          }}
        >
          Solve, Curate, Retrieve.
        </Grid>
        <Grid
          item
          xs={12}
          sx={{
            fontSize: '30px',
            textAlign: 'center',
            color: theme => `${theme.palette.text.primary}`,
          }}
        >
          An opinionated note-taking system for technical professionals.
        </Grid>
      </Grid>
    </>
  );
};
export default React.memo(PublicHomePage);
