import {AppBar, Box} from '@mui/material';
import Grid from '@mui/material/Grid';
import React from 'react';

import {Footer} from './components/Footer';
import {GithubAuth} from './GithubAuth';
import {GoogleAuth} from './GoogleAuth';
import {StyledToolbar} from './styled/layout/StyledToolbar';

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
          <Box
            display="flex"
            justifyContent="flex-end"
            alignItems="center" // vertically center the items
            flexGrow={1}
            mr={1}
          >
            <GithubAuth />
            <GoogleAuth />
          </Box>
        </StyledToolbar>
      </AppBar>
      <Grid
        container
        sx={theme => ({
          paddingTop: `${theme.appBar.height}px`,
          minHeight: `calc(100vh - ${theme.appBar.height}px)`,
          display: 'flex',
          flexDirection: 'column',
        })}
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
          id="tagLine"
          sx={{
            fontSize: '30px',
            textAlign: 'center',
            color: theme => `${theme.palette.text.primary}`,
          }}
          size={{xs: 12}}
        >
          An opinionated note-taking system for technical professionals.
        </Grid>
        <Footer />
      </Grid>
    </>
  );
};

const memoizedPublicHomePage = React.memo(PublicHomePage);
export {memoizedPublicHomePage as PublicHomePage};
