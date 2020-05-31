import React, { useRef } from 'react'
import Tag from './Tag.jsx'
import { makeStyles } from '@material-ui/core/styles';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import CustomDrawer from './CustomDrawer.jsx';

const RightDrawer = function () {
  return (
    <CustomDrawer anchor="right">
    </CustomDrawer>
  )
}
export default RightDrawer
