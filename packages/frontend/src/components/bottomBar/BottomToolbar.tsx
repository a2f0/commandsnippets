import {AppBar} from '@mui/material';
import {StyledToolbar} from '../../styled/StyledToolbar';
import {BottomBar} from './BottomBar';

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
