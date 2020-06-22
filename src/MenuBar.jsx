import React, { useContext } from 'react'
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import Fade from '@material-ui/core/Fade';
import { withStyles } from '@material-ui/core/styles';
import Toolbar from '@material-ui/core/Toolbar';
import { makeStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import { useTheme } from '@material-ui/styles';

import WbSunnyIcon from '@material-ui/icons/WbSunny';
import Brightness3Icon from '@material-ui/icons/Brightness3';
import { darkTheme, lightTheme } from './themes.js'
import ListItemIcon from '@material-ui/core/ListItemIcon';
import CheckIcon from '@material-ui/icons/Check';
import { useObserver } from 'mobx-react'
import AppContext from './AppContext.js'


import ArrowDownwardIcon from '@material-ui/icons/ArrowDownward'
import ArrowUpwardIcon from '@material-ui/icons/ArrowUpward'

const StyledMenu = withStyles({
  paper: {
    // border: '1px solid #d3d4d5',
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
    // elevation={0}
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
  },
  menuButton: {
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
    paddingLeft: 10,
    paddingRight: 30,
    paddingTop: 3,
    paddingBottom: 3,
    fontSize: 12,
    // border: '1px solid red'
  },
  themeSwitcher: {
    height: 16,
  }
}));

const MenuBar = React.memo(function MenuBar(props) {
  const classes = useStyles();
  const theme = useTheme();
  const [fileMenuAnchorEl, setFileMenuAnchorEl] = React.useState(null);
  const [editMenuAnchorEl, setEditMenuAnchorEl] = React.useState(null);
  const [viewMenuAnchorEl, setViewMenuAnchorEl] = React.useState(null);
  const [helpMenuAnchorEl, setHelpMenuAnchorEl] = React.useState(null);

  const handleFileMenuClick = (event) => {
    setFileMenuAnchorEl(event.currentTarget);
  };

  const handleFileMenuClose = () => {
    setFileMenuAnchorEl(null);
  };

  const handleEditMenuClick = (event) => {
    setEditMenuAnchorEl(event.currentTarget);
  };

  const handleEditMenuClose = () => {
    setEditMenuAnchorEl(null);
  };

  const handleViewMenuClick = (event) => {
    setViewMenuAnchorEl(event.currentTarget);
  };

  const handleViewMenuClose = () => {
    setViewMenuAnchorEl(null);
  };

  const handleHelpMenuClick = (event) => {
    setHelpMenuAnchorEl(event.currentTarget);
  };

  const handleHelpMenuClose = () => {
    setHelpMenuAnchorEl(null);
  };

  const handleSetEntrySortOrder = (order) => {
    appConfig.entrySortOrder = order
  };

  const appConfig = useContext(AppContext)
  
  return useObserver(() => (
    <>
      <Toolbar variant="dense" className={classes.toolBar}>
        <Typography className={classes.drawer}>
        </Typography>
        <Typography style={{...theme.custom.dragIndicator}}>
        </Typography>
        <Button size="small" label="Primary" aria-controls="file-menu" className={classes.menuButton} aria-haspopup="true" onClick={handleFileMenuClick}>
      File
        </Button>
        <Button size="small" label="Primary" aria-controls="edit-menu" className={classes.menuButton} aria-haspopup="true" onClick={handleEditMenuClick}>
      Edit
        </Button>
        <Button size="small" label="Primary" aria-controls="view-menu" className={classes.menuButton} aria-haspopup="true" onClick={handleViewMenuClick}>
      View
        </Button>
        <Button size="small" label="Primary" aria-controls="view-menu" className={classes.menuButton} aria-haspopup="true" onClick={handleHelpMenuClick}>
      Help
        </Button>
      </Toolbar>
      <StyledMenu
        id="file-menu"
        anchorEl={fileMenuAnchorEl}
        open={Boolean(fileMenuAnchorEl)}
        onClose={handleFileMenuClose}
        TransitionComponent={Fade}
      >
        <MenuItem className={classes.menuItem} onClick={handleFileMenuClose}>Create a personal tag</MenuItem>
        <MenuItem className={classes.menuItem} onClick={handleFileMenuClose}>Logout</MenuItem>
      </StyledMenu>
      <StyledMenu
        id="edit-menu"
        anchorEl={editMenuAnchorEl}
        open={Boolean(editMenuAnchorEl)}
        onClose={handleEditMenuClose}
        TransitionComponent={Fade}
      >
        <MenuItem className={classes.menuItem} onClick={handleEditMenuClose}>Edit 1</MenuItem>
        <MenuItem className={classes.menuItem} onClick={handleEditMenuClose}>Edit 2</MenuItem>
      </StyledMenu>
      <StyledMenu
        id="view-menu"
        anchorEl={viewMenuAnchorEl}
        open={Boolean(viewMenuAnchorEl)}
        onClose={handleViewMenuClose}
        TransitionComponent={Fade}
      >
        <MenuItem className={classes.menuItem} onClick={() => { handleSetEntrySortOrder("order"); handleViewMenuClose();}} >
          <ListItemIcon>
            {
              appConfig.entrySortOrder == "order" &&
              <CheckIcon fontSize="small" />
            }
          </ListItemIcon> 
          Sort by User-Defined Order
        </MenuItem>
        <MenuItem className={classes.menuItem} onClick={() => { handleSetEntrySortOrder("text_entry__subject"); handleViewMenuClose();}} >
          <ListItemIcon>
            {
              appConfig.entrySortOrder == "text_entry__subject" &&
              <CheckIcon fontSize="small" />
            }
          </ListItemIcon> 
          Sort by Subject <ArrowDownwardIcon fontSize="small" />
        </MenuItem>
        <MenuItem className={classes.menuItem} onClick={() => { handleSetEntrySortOrder("-text_entry__subject"); handleViewMenuClose();}} >
          <ListItemIcon>
            {
              appConfig.entrySortOrder == "-text_entry__subject" &&
              <CheckIcon fontSize="small" />
            }
          </ListItemIcon> 
          Sort by Subject <ArrowUpwardIcon fontSize="small" />
        </MenuItem>
        <MenuItem className={classes.menuItem} onClick={() => { handleSetEntrySortOrder("text_entry__body"); handleViewMenuClose();}} >
          <ListItemIcon>
            {
              appConfig.entrySortOrder == "text_entry__body" &&
              <CheckIcon fontSize="small" />
            }
          </ListItemIcon> 
          Sort by Body <ArrowDownwardIcon fontSize="small" />
        </MenuItem>
        <MenuItem className={classes.menuItem} onClick={() => { handleSetEntrySortOrder("-text_entry__body"); handleViewMenuClose();}} >
          <ListItemIcon>
            {
              appConfig.entrySortOrder == "-text_entry__body" &&
              <CheckIcon fontSize="small" />
            }
          </ListItemIcon> 
          Sort by Body <ArrowUpwardIcon fontSize="small" />
        </MenuItem>
        <MenuItem className={classes.menuItem} onClick={() => { handleSetEntrySortOrder("date_created"); handleViewMenuClose();}}>
          <ListItemIcon>
            {
              appConfig.entrySortOrder == "date_created" &&
              <CheckIcon fontSize="small" />
            }
          </ListItemIcon>  
          Sort by Date Tagged <ArrowDownwardIcon fontSize="small" />
        </MenuItem>
        <MenuItem className={classes.menuItem} onClick={() => { handleSetEntrySortOrder("-date_created"); handleViewMenuClose();}} divider>
          <ListItemIcon>
            {
              appConfig.entrySortOrder== "-date_created" &&
              <CheckIcon fontSize="small" />
            }
          </ListItemIcon>
          Sort by Date Tagged <ArrowUpwardIcon fontSize="small" />
        </MenuItem>
        <MenuItem className={classes.menuItem} onClick={() => { props.handleThemeSwitcher(lightTheme); handleViewMenuClose();}}>
          <ListItemIcon>
            {
              theme == lightTheme &&
                <CheckIcon fontSize="small" />
            }
          </ListItemIcon>
          Light Mode
          {/* <WbSunnyIcon className={classes.themeSwitcher} style={{color: theme.palette.text.primary}} /> */}
        </MenuItem>
        <MenuItem className={classes.menuItem} onClick={() => { props.handleThemeSwitcher(darkTheme); handleViewMenuClose();}}>
          <ListItemIcon>
            {
              theme == darkTheme &&
                <CheckIcon fontSize="small" />
            }
          </ListItemIcon>
          Dark Mode
          {/* <Brightness3Icon className={classes.themeSwitcher} style={{color: theme.palette.text.primary}}/> */}
        </MenuItem>
      </StyledMenu>
      <StyledMenu
        id="help-menu"
        anchorEl={helpMenuAnchorEl}
        open={Boolean(helpMenuAnchorEl)}
        onClose={handleHelpMenuClose}
        TransitionComponent={Fade}
      >
        <MenuItem className={classes.menuItem} onClick={handleHelpMenuClose}>Help 1</MenuItem>
        <MenuItem className={classes.menuItem} onClick={handleHelpMenuClose}>Help 2</MenuItem>
      </StyledMenu>
    </>
  ))
})
export default MenuBar
