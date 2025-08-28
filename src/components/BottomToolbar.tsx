import {AppBar} from '@mui/material';

import {BottomBar} from '../lib/bottom_bar/BottomBar';
import {StyledToolbar} from '../styled/layout/StyledToolbar';

const BottomToolbar = () => {
  return (
    <AppBar
      position="fixed"
      sx={{
        backgroundColor: theme => theme.palette.background.default,
        bottom: 0,
        top: 'auto',
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
