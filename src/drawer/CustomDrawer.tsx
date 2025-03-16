import {Drawer, type DrawerProps} from '@mui/material';
import * as React from 'react';

const CustomDrawer = ({anchor = 'left', children}: DrawerProps) => (
  <Drawer anchor={anchor} variant="permanent">
    {children}
  </Drawer>
);
export default React.memo(CustomDrawer);
