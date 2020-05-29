import React, { useState, useEffect } from 'react'
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import Fade from '@material-ui/core/Fade';
import { withStyles } from '@material-ui/core/styles';
import Toolbar from '@material-ui/core/Toolbar';
import { makeStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';

const StyledMenu = withStyles({
  paper: {
    border: '0px solid #d3d4d5',
    borderRadius: 0,
    margin: 0
  },
  list: {
    padding: 0
  }
})((props) => (
  <Menu
    transitionDuration={0}
    getContentAnchorEl={null}
    anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
    transformOrigin={{ vertical: "top", horizontal: "left" }}
    keepMounted
    elevation={0}
    getContentAnchorEl={null}
    {...props}
  />
));

const drawerWidth = 150;

const useStyles = makeStyles((theme) => ({	
  drawer: {
    width: drawerWidth,
    flexShrink: 0,
  },
  toolBar: {
    minHeight: 0,
    padding: 0,
    background: "black"
  },
  menuButton: {
    background: "black",
    textTransform: 'none',
    padding: 0,
    minWidth: 0,
    marginRight: 10,
    "&:hover": {
      borderRadius: 0,
      color: "#FF00FF"
    },
    "&:active": {
      backgroundColor: "#585858",	
      borderRadius: 0	
    }
  },
  menuItem: {	
    background: "black",	
    color: 'white',	
    fontSize: 12
  },
}));


const MenuBar = React.memo(function EntryList(props) {
  const [anchorEl, setAnchorEl] = React.useState(null);
  const classes = useStyles();

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <Toolbar variant="dense" className={classes.toolBar}>
        <Typography className={classes.drawer}>
        </Typography>
        <Button size="small" color="inherit" label="Primary" aria-controls="file-menu" className={classes.menuButton} aria-haspopup="true" onClick={handleClick}>
      File
        </Button>
        <Button size="small" color="inherit" label="Primary" aria-controls="edit-menu" className={classes.menuButton} aria-haspopup="true" onClick={handleClick}>
      Edit
        </Button>

        <Button size="small" color="inherit" label="Primary" aria-controls="view-menu" className={classes.menuButton} aria-haspopup="true" onClick={handleClick}>
      View
        </Button>
        <Button size="small" color="inherit" label="Primary" aria-controls="help-menu" className={classes.menuButton} aria-haspopup="true" onClick={handleClick}>
      Help
        </Button>
      </Toolbar>
      <StyledMenu
        id="file-menu"
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        TransitionComponent={Fade}
      >
        <MenuItem className={classes.menuItem} onClick={handleClose}>Profile</MenuItem>
        <MenuItem className={classes.menuItem} onClick={handleClose}>My account</MenuItem>
        <MenuItem className={classes.menuItem} onClick={handleClose}>Logout</MenuItem>
      </StyledMenu>
    </>
  )
})
export default MenuBar
