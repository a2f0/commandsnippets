import {makeStyles} from '@material-ui/core/styles';
import * as Constants from './constants.ts';
import React from 'react';
import Drawer from '@material-ui/core/Drawer';

const useStyles = makeStyles({
  button: {
    textTransform: 'none',
  },
  root: {
    display: 'flex',
    background: 'red',
  },
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
  drawerContainer: {
    overflow: 'auto',
  },
  toolBar: {
    minHeight: 0,
    padding: 0,
  },
  title: {
    flexGrow: 1,
  },
  list: {
    padding: 0,
  },
});

const CustomDrawer = function (props) {
  const classes = useStyles();
  return (
    <Drawer
      anchor={props.anchor}
      className={classes.drawer}
      variant="permanent"
      classes={{
        paper: classes.drawerPaper,
      }}
    >
      {props.children}
    </Drawer>
  );
};
export default CustomDrawer;
