import React, { useRef } from 'react'
import Tag from './Tag.jsx'
import { makeStyles } from '@material-ui/core/styles';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import CustomDrawer from './CustomDrawer.jsx';

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
    width: drawerWidth,
    background: "green",
    color: "white"
  },
  drawerContainer: {
    overflow: 'auto',
  },
  toolBar: {	
    minHeight: 0,	
    padding: 0,	
    background: "black"	
  },	
  title: {	
    flexGrow: 1,	
  },
  svgIcon: {	
    color: "white",	
    fontSize: 12	
  },
  list: {	
    padding: 0	
  },
}));

const LeftDrawer = function () {
  const classes = useStyles();
  return (
    <CustomDrawer anchor="left">
      <div className={classes.drawerContainer}>
        <List>
          <ListItem button>
            <Tag id='233' name='docker1'/>
          </ListItem>
          <ListItem button>
            <Tag id='133' name='aws1'/>
          </ListItem>
        </List>
      </div>
    </CustomDrawer>
  )
}
export default LeftDrawer
