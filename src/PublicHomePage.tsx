import {AppBar} from '@mui/material';
import Grid from '@mui/material/Grid2';
import React from 'react';

import GithubAuth from './GithubAuth';
import GoogleAuth from './GoogleAuth';
import StyledToolbar from './styled/layout/StyledToolbar';

const PublicHomePage = () => {
  return (
    <>
      <AppBar
        position="fixed"
        sx={{
          height: theme => `${theme.appBar.height}px`,
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
          paddingTop: theme => `${theme.appBar.height}px`,
        }}
      >
        <Grid
          sx={{
            marginTop: '250px',
            fontSize: '64px',
            textAlign: 'center',
            color: theme => `${theme.palette.text.primary}`,
          }}
          size={{xs: 12}}
        >
          Solve, Curate, Retrieve.
        </Grid>
        <Grid
          sx={{
            fontSize: '30px',
            textAlign: 'center',
            color: theme => `${theme.palette.text.primary}`,
          }}
          size={{xs: 12}}
        >
          An opinionated note-taking system for technical professionals.
        </Grid>
      </Grid>
    </>
  );
};
export default React.memo(PublicHomePage);
