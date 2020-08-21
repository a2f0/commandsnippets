import React, { useRef } from 'react'
import Drawer from '@material-ui/core/Drawer';
import { makeStyles } from '@material-ui/core/styles';

const drawerWidth = 150;
const appBarHeight = 52;

const useStyles = makeStyles((theme) => ({	
  button: {	
    textTransform: 'none'	
  },
  root: {
    display: 'flex',
    background: 'red'
  },
  drawer: {
    width: drawerWidth,
    flexShrink: 0,
  },
  drawerPaper: {
    marginTop: appBarHeight,
    borderRight: 0,
    borderLeft: 0,
    width: drawerWidth,
    overflow: "hidden"
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
    padding: 0	
  },
}));

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
  )
}
export default CustomDrawer