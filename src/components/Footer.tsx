import {Box, Grid, Link, Typography} from '@mui/material';
import React from 'react';

const Footer = () => {
  if (import.meta.env.PROD) {
    return null;
  }

  return (
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
        {[
          {href: '/privacy', text: 'Privacy Policy'},
          {href: '/terms', text: 'Terms of Service'},
          {href: '/contact', text: 'Contact Us'},
          {href: '/about', text: 'About'},
        ].map(link => (
          <Grid sx={{}} size={{xs: 'auto'}} key={link.href}>
            <Link href={link.href} color="inherit" underline="hover">
              <Typography variant="body2">{link.text}</Typography>
            </Link>
          </Grid>
        ))}
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
  );
};

const memoizedFooter = React.memo(Footer);
export {memoizedFooter as Footer};
