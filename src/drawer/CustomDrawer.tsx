import {Drawer, DrawerProps} from '@mui/material';
import * as React from 'react';

const CustomDrawer = function ({anchor = "left", children}: DrawerProps) {
  return (
    <Drawer anchor={anchor} variant="permanent">
      {children}
    </Drawer>
  );
};
export default React.memo(CustomDrawer);
