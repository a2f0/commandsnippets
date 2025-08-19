import {Drawer, type DrawerProps} from '@mui/material';
import * as React from 'react';

const CustomDrawer = ({anchor = 'left', children}: DrawerProps) => (
  <Drawer anchor={anchor} variant="permanent">
    {children}
  </Drawer>
);

const memoizedCustomDrawer = React.memo(CustomDrawer);
export {memoizedCustomDrawer as CustomDrawer};
