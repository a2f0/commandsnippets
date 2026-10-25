import {Drawer, type DrawerProps} from '@mui/material';
import * as React from 'react';

const CustomDrawer = ({anchor = 'left', children, ...props}: DrawerProps) => (
  <Drawer anchor={anchor} variant="permanent" {...props}>
    {children}
  </Drawer>
);

const memoizedCustomDrawer = React.memo(CustomDrawer);

export {memoizedCustomDrawer as CustomDrawer};
