import {AppBar, Box, Link, Typography} from '@mui/material';
import Grid from '@mui/material/Grid';
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
        sx={{
          paddingTop: theme => `${theme.appBar.height}px`,
          minHeight: 'calc(100vh - 64px)', // Ensure content fills page with space for footer
          display: 'flex',
          flexDirection: 'column',
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
        <Box
          component="footer"
          sx={{
            py: 3,
            px: 2,
            mt: 'auto',
            backgroundColor: theme =>
              theme.palette.mode === 'light'
                ? theme.palette.grey[200]
                : theme.palette.grey[800],
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Grid container justifyContent="center" spacing={2}>
            <Grid sx={{}} size={{xs: 'auto'}}>
              <Link href="/privacy" color="inherit" underline="hover">
                <Typography variant="body2">Privacy Policy</Typography>
              </Link>
            </Grid>
            <Grid sx={{}} size={{xs: 'auto'}}>
              <Link href="/terms" color="inherit" underline="hover">
                <Typography variant="body2">Terms of Service</Typography>
              </Link>
            </Grid>
            <Grid sx={{}} size={{xs: 'auto'}}>
              <Link href="/contact" color="inherit" underline="hover">
                <Typography variant="body2">Contact Us</Typography>
              </Link>
            </Grid>
            <Grid sx={{}} size={{xs: 'auto'}}>
              <Link href="/about" color="inherit" underline="hover">
                <Typography variant="body2">About</Typography>
              </Link>
            </Grid>
          </Grid>
          <Typography
            variant="body2"
            color="text.secondary"
            align="center"
            sx={{mt: 1}}
          >
            © {new Date().getFullYear()} Tearleads. All rights reserved.
          </Typography>
        </Box>
      </Grid>
    </>
  );
};
export default React.memo(PublicHomePage);
