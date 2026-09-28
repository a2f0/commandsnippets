import {AppBar} from '@mui/material';
import React from 'react';

import {MenuBar} from '../MenuBar';
import {StyledToolbar} from '../styled/layout/StyledToolbar';

const BORDER_COLOR = '#808080';

/** The sticky top bar with the menu, shared by the main and admin pages. */
const AppHeader = () => (
  <AppBar
    position="sticky"
    sx={{
      boxShadow: 'none',
      backgroundImage: 'none',
      borderBottom: `1px solid ${BORDER_COLOR}`,
      backgroundColor: theme => theme.header.background,
      top: 0,
      height: theme => `${theme.appBar.height}px`,
    }}
  >
    <StyledToolbar>
      <MenuBar />
    </StyledToolbar>
  </AppBar>
);

const memoizedAppHeader = React.memo(AppHeader);

export {memoizedAppHeader as AppHeader};
