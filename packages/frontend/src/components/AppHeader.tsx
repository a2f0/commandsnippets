import {AppBar} from '@mui/material';
import React from 'react';

import {MenuBar} from '../menu/MenuBar';
import {StyledToolbar} from '../styled/StyledToolbar';

const BORDER_COLOR = '#808080';

interface IProps {
  /** False on pages other than the entries page (see MenuBar). */
  entriesPage?: boolean;
}

/** The sticky top bar with the menu, shared by the main and admin pages. */
const AppHeader = ({entriesPage = true}: IProps) => (
  <AppBar
    position="sticky"
    sx={{
      boxShadow: 'none',
      backgroundImage: 'none',
      borderBottom: `1px solid ${BORDER_COLOR}`,
      backgroundColor: theme => theme.header.background,
      top: 0,
      height: theme => `${theme.appBar.height}px`,
      // Detail pages have no drawer to align with; keep a narrow viewport's
      // menus within the header, including the extra controls staff see.
      ...(!entriesPage && {
        '& .MuiToolbar-root': {overflowX: 'auto', scrollbarWidth: 'thin'},
      }),
    }}
  >
    <StyledToolbar>
      <MenuBar entriesPage={entriesPage} />
    </StyledToolbar>
  </AppBar>
);

const memoizedAppHeader = React.memo(AppHeader);

export {memoizedAppHeader as AppHeader};
