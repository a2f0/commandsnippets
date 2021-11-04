import * as Constants from './constants';
import * as React from 'react';
import Drawer, {DrawerProps} from '@mui/material/Drawer';
import makeStyles from '@mui/styles/makeStyles';

const useStyles = makeStyles({
  root: {
    width: `${Constants.drawerWidth}px`,
  },
  paper: {
    marginTop: `${Constants.appBarHeight}px`,
    borderRight: 0,
    borderLeft: 0,
    width: `${Constants.drawerWidth}px`,
    overflow: 'hidden',
    flexShrink: 0,
    marginBottom: `${Constants.footerHeight}px)`,
    height: `calc(100vh - ${Constants.appBarHeight}px - ${Constants.footerHeight}px)`,
    zIndex: 1000,
  },
});

const CustomDrawer = function ({anchor, children}: DrawerProps) {
  const classes = useStyles();
  return (
    <Drawer
      anchor={anchor}
      variant="permanent"
      classes={{
        paper: classes.paper,
        root: classes.root,
      }}
    >
      {children}
    </Drawer>
  );
};
export default React.memo(CustomDrawer);
