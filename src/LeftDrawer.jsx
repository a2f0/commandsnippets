import React from 'react'
import Tag from './Tag.jsx'
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import CustomDrawer from './CustomDrawer.jsx';

const drawerWidth = 150;
const appBarHeight = 52;

const LeftDrawer = function () {
  return (
    <CustomDrawer anchor="left">
      <List>
        <ListItem button>
          <Tag id='233' name='docker1'/>
        </ListItem>
        <ListItem button>
          <Tag id='133' name='aws1'/>
        </ListItem>
      </List>
    </CustomDrawer>
  )
}
export default LeftDrawer
