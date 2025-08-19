import {AppBar, Box} from '@mui/material';
import React from 'react';

import {Footer} from './components/Footer';
import {GithubAuth} from './GithubAuth';
import {GoogleAuth} from './GoogleAuth';
import {StyledToolbar} from './styled/layout/StyledToolbar';

const PublicHomePage = () => {
  return (
    <Box sx={{height: '100vh', display: 'flex', flexDirection: 'column'}}>
      <AppBar
        position="static"
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
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginTop: '250px',
          }}
        >
          <Box
            sx={{
              fontSize: '64px',
              textAlign: 'center',
              color: theme => `${theme.palette.text.primary}`,
            }}
          >
            Solve, Curate, Retrieve.
          </Box>
          <Box
            id="tagLine"
            sx={{
              fontSize: '30px',
              textAlign: 'center',
              color: theme => `${theme.palette.text.primary}`,
            }}
          >
            An opinionated note-taking system for technical professionals.
          </Box>
        </Box>
        <Footer />
      </Box>
    </Box>
  );
};

const memoizedPublicHomePage = React.memo(PublicHomePage);
export {memoizedPublicHomePage as PublicHomePage};
