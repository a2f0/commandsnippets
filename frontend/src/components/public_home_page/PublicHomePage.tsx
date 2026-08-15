import {AppBar, Box, Typography} from '@mui/material';
import React from 'react';
import {GithubAuth} from '../../GithubAuth';
import {GoogleAuthWrapper} from '../../GoogleAuthWrapper';
import {StyledToolbar} from '../../styled/layout/StyledToolbar';
import {SafeAreaProvider, useSafeArea} from '../SafeAreaProvider';
import {Footer} from './Footer';

const PublicHomePageContent = () => {
  const {insets, isNativePlatform} = useSafeArea();
  return (
    <Box sx={{height: '100vh', display: 'flex', flexDirection: 'column'}}>
      <AppBar
        position="static"
        sx={{
          height: theme =>
            `${theme.appBar.height + (isNativePlatform ? insets.top : 0)}px`,
          boxShadow: 'none', // Remove the Material UI 'bottom border'.
          backgroundImage: 'none', // Remove the Material UI gradient.
          borderBottom: '1px solid #808080',
          backgroundColor: theme => theme.header.background,
          paddingTop: isNativePlatform ? `${insets.top}px` : 0,
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
            <GoogleAuthWrapper />
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
          <Typography
            variant="h1"
            component="h1"
            sx={{
              fontSize: '64px',
              textAlign: 'center',
              color: theme => theme.palette.text.primary,
            }}
          >
            Solve, Curate, Retrieve.
          </Typography>
          <Typography
            variant="h4"
            component="p"
            id="tagLine"
            sx={{
              fontSize: '30px',
              textAlign: 'center',
              color: theme => theme.palette.text.primary,
            }}
          >
            An opinionated note-taking system for technical professionals.
          </Typography>
        </Box>
        <Footer />
      </Box>
    </Box>
  );
};

const MemoizedPublicHomePageContent = React.memo(PublicHomePageContent);

const PublicHomePage = () => {
  return (
    <SafeAreaProvider>
      <MemoizedPublicHomePageContent />
    </SafeAreaProvider>
  );
};

export {PublicHomePage};
