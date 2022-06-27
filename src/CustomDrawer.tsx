import * as React from 'react';
import Drawer, {DrawerProps} from '@mui/material/Drawer';

const CustomDrawer = function ({anchor, children}: DrawerProps) {
  return (
    <Drawer anchor={anchor} variant="permanent">
      {children}
    </Drawer>
  );
};
export default React.memo(CustomDrawer);
