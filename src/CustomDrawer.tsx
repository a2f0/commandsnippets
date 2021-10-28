import * as Constants from './constants';
import * as React from 'react';
import Drawer, {DrawerProps} from '@mui/material/Drawer';
import makeStyles from '@mui/styles/makeStyles';

const useStyles = makeStyles({
  drawer: {
    width: Constants.drawerWidth,
    flexShrink: 0,
  },
  drawerPaper: {
    marginTop: Constants.appBarHeight,
    borderRight: 0,
    borderLeft: 0,
    width: Constants.drawerWidth,
    overflow: 'hidden',
  },
});

const CustomDrawer = function ({anchor, children}: DrawerProps) {
  const classes = useStyles();
  return (
    <Drawer
      anchor={anchor}
      className={classes.drawer}
      variant="permanent"
      classes={{
        paper: classes.drawerPaper,
      }}
    >
      {children}
    </Drawer>
  );
};
export default React.memo(CustomDrawer);
