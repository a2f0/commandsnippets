import {AppBar} from '@mui/material';

import {BottomBar} from '../lib/bottom_bar/BottomBar';
import {StyledToolbar} from '../styled/layout/StyledToolbar';

const BottomToolbar = () => {
  return (
    <AppBar
      position="sticky"
      sx={{
        backgroundColor: theme => theme.palette.background.default,
        backgroundImage: 'none', // Remove the Material UI gradient.
        bottom: 0,
        marginTop: 'auto', // This pushes the footer to the bottom
      }}
    >
      <StyledToolbar>
        <BottomBar />
      </StyledToolbar>
    </AppBar>
  );
};

export {BottomToolbar};
