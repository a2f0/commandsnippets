import {AppBar} from '@mui/material';

import {BottomBar} from '../lib/bottom_bar/BottomBar';
import {StyledToolbar} from '../styled/layout/StyledToolbar';

const BottomToolbar = () => {
  return (
    <AppBar
      position="sticky"
      sx={{
        backgroundColor: theme => theme.palette.background.default,
        bottom: 0,
        backgroundImage: 'none', // Remove the Material UI gradient.
      }}
    >
      <StyledToolbar>
        <BottomBar />
      </StyledToolbar>
    </AppBar>
  );
};

export {BottomToolbar};
