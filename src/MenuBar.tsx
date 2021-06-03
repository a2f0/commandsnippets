import React from 'react';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import Fade from '@material-ui/core/Fade';
import {WithStyles} from '@material-ui/core';
import {createStyles, withStyles} from '@material-ui/core/styles';
import Toolbar from '@material-ui/core/Toolbar';
import {makeStyles} from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import {darkTheme, lightTheme} from './themes';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import CheckIcon from '@material-ui/icons/Check';
import {useAppContext} from './AppContext';
import {useHistory} from 'react-router-dom';
import {observer} from 'mobx-react';
import {baseHTTPURL} from './api';
import {Theme} from '@material-ui/core/styles';
import ArrowDownwardIcon from '@material-ui/icons/ArrowDownward';
import ArrowUpwardIcon from '@material-ui/icons/ArrowUpward';
import axios from 'axios';

const sty = () => {
  return createStyles({
    paper: {
      borderRadius: 0,
      margin: 0,
    },
    list: {
      padding: 0,
    },
  });
};

interface IStyledMenuProps extends WithStyles<typeof sty> {
  id: string;
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  classes: {
    paper: string;
    list: string;
  };
  children: React.PropsWithChildren<{}>;
}

const StyledMenu = withStyles(sty)(
  ({id, anchorEl, open, onClose, classes, children}: IStyledMenuProps) => {
    return (
      <Menu
        id={id}
        anchorEl={anchorEl}
        onClose={onClose}
        transitionDuration={0}
        getContentAnchorEl={null}
        anchorOrigin={{vertical: 'bottom', horizontal: 'left'}}
        transformOrigin={{vertical: 'top', horizontal: 'left'}}
        keepMounted
        classes={classes}
        open={open}
        TransitionComponent={Fade}
      >
        {children}
      </Menu>
    );
  }
);

const drawerWidth = 150;

const useStyles = makeStyles({
  drawer: {
    width: drawerWidth,
    flexShrink: 0,
  },
  toolBar: {
    minHeight: 0,
    padding: 0,
    borderBottom: '.5px solid',
  },
  menuButton: {
    textTransform: 'none',
    padding: 0,
    minWidth: 0,
    marginRight: 10,
    '&:hover': {
      borderRadius: 0,
      color: '#FF00FF',
    },
    '&:active': {
      backgroundColor: '#585858',
      borderRadius: 0,
    },
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
  },
  dragIndicator: {
    display: 'inline-block',
    width: '15px',
  },
});

interface IMenuBarProps {
  handleThemeSwitcher: (theme: Theme) => void;
}

const MenuBar = React.memo(
  observer((props: IMenuBarProps) => {
    const classes = useStyles();
    const history = useHistory();
    const appConfig = useAppContext();

    const [fileMenuAnchorEl, setFileMenuAnchorEl] =
      React.useState<null | HTMLElement>(null);
    const [editMenuAnchorEl, setEditMenuAnchorEl] =
      React.useState<null | HTMLElement>(null);
    const [viewMenuAnchorEl, setViewMenuAnchorEl] =
      React.useState<null | HTMLElement>(null);
    const [entriesMenuAnchorEl, setEntriesMenuAnchorEl] =
      React.useState<null | HTMLElement>(null);
    const [helpMenuAnchorEl, setHelpMenuAnchorEl] =
      React.useState<null | HTMLElement>(null);
    const [tagsMenuAnchorEl, setTagsMenuAnchorEl] =
      React.useState<null | HTMLElement>(null);

    const handleNavigateToLogin = () => {
      history.push('/login');
    };

    const handleLogout = () => {
      const base_url = baseHTTPURL();
      const logout_api = axios.create({
        baseURL: base_url,
        responseType: 'json',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      logout_api
        .post('/api-token-deauth/', {}, {withCredentials: true})
        .then(() => {
          // Login succeded
          appConfig.setLoggedInUser('');
          setFileMenuAnchorEl(null);
        })
        .catch(() => {
          // Login failed
        })
        .then(() => {
          // always executed
        });
    };

    const handleFileMenuClick = (
      event: React.MouseEvent<HTMLButtonElement>
    ) => {
      setFileMenuAnchorEl(event.currentTarget);
    };

    const handleFileMenuClose = () => {
      setFileMenuAnchorEl(null);
    };

    // const handleEditMenuClick = event => {
    //   setEditMenuAnchorEl(event.currentTarget);
    // };

    const handleEditMenuClose = () => {
      setEditMenuAnchorEl(null);
    };

    const handleViewMenuClick = (
      event: React.MouseEvent<HTMLButtonElement>
    ) => {
      setViewMenuAnchorEl(event.currentTarget);
    };

    const handleTagsMenuClick = (
      event: React.MouseEvent<HTMLButtonElement>
    ) => {
      setTagsMenuAnchorEl(event.currentTarget);
    };

    const handleEntriesMenuClick = (
      event: React.MouseEvent<HTMLButtonElement>
    ) => {
      setEntriesMenuAnchorEl(event.currentTarget);
    };

    const handleViewMenuClose = () => {
      setViewMenuAnchorEl(null);
    };

    const handleTagsMenuClose = () => {
      setTagsMenuAnchorEl(null);
    };

    const handleEntriesMenuClose = () => {
      setEntriesMenuAnchorEl(null);
    };

    // const handleHelpMenuClick = event => {
    //   setHelpMenuAnchorEl(event.currentTarget);
    // };

    const handleHelpMenuClose = () => {
      setHelpMenuAnchorEl(null);
    };

    const handleSetTagSortOrder = (order: string) => {
      appConfig.setTagSortOrder(order);
    };

    const handleSetEntrySortOrder = (order: string) => {
      appConfig.setEntrySortOrder(order);
    };

    const handleCreateTag = () => {
      appConfig.setTagNew(true);
    };

    return (
      <>
        <Toolbar variant="dense" className={classes.toolBar}>
          <Typography className={classes.drawer}></Typography>
          <Typography className={classes.dragIndicator}></Typography>
          <Button
            size="small"
            aria-controls="file-menu"
            className={classes.menuButton}
            aria-haspopup="true"
            onClick={handleFileMenuClick}
          >
            File
          </Button>
          {/* <Button size="small" label="Primary" aria-controls="edit-menu" className={classes.menuButton} aria-haspopup="true" onClick={handleEditMenuClick}>
      Edit
        </Button> */}
          <Button
            size="small"
            aria-controls="view-menu"
            className={classes.menuButton}
            aria-haspopup="true"
            onClick={handleViewMenuClick}
          >
            View
          </Button>
          <Button
            size="small"
            aria-controls="view-menu"
            className={classes.menuButton}
            aria-haspopup="true"
            onClick={handleTagsMenuClick}
          >
            Tags
          </Button>
          <Button
            size="small"
            aria-controls="view-menu"
            className={classes.menuButton}
            aria-haspopup="true"
            onClick={handleEntriesMenuClick}
          >
            Entries
          </Button>

          {/* <Button size="small" label="Primary" aria-controls="view-menu" className={classes.menuButton} aria-haspopup="true" onClick={handleHelpMenuClick}>
      Help
        </Button> */}
        </Toolbar>
        <StyledMenu
          id="file-menu"
          anchorEl={fileMenuAnchorEl}
          open={Boolean(fileMenuAnchorEl)}
          onClose={handleFileMenuClose}
        >
          {appConfig.loggedInUser && (
            <MenuItem className={classes.menuItem} onClick={handleCreateTag}>
              Create a Tag
            </MenuItem>
          )}
          {appConfig.loggedInUser && (
            <MenuItem
              className={classes.menuItem}
              onClick={handleFileMenuClose}
            >
              Create an Entry
            </MenuItem>
          )}
          {!appConfig.loggedInUser && (
            <MenuItem
              className={classes.menuItem}
              onClick={handleNavigateToLogin}
            >
              Login
            </MenuItem>
          )}
          {appConfig.loggedInUser && (
            <MenuItem className={classes.menuItem} onClick={handleLogout}>
              Logout
            </MenuItem>
          )}
        </StyledMenu>
        <StyledMenu
          id="edit-menu"
          anchorEl={editMenuAnchorEl}
          open={Boolean(editMenuAnchorEl)}
          onClose={handleEditMenuClose}
        >
          <MenuItem className={classes.menuItem} onClick={handleEditMenuClose}>
            Edit 1
          </MenuItem>
          <MenuItem className={classes.menuItem} onClick={handleEditMenuClose}>
            Edit 2
          </MenuItem>
        </StyledMenu>
        <StyledMenu
          id="view-menu"
          anchorEl={viewMenuAnchorEl}
          open={Boolean(viewMenuAnchorEl)}
          onClose={handleViewMenuClose}
        >
          <MenuItem
            className={classes.menuItem}
            onClick={() => {
              props.handleThemeSwitcher(lightTheme);
              handleViewMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.selectedTheme === 'lightTheme' && (
                <CheckIcon fontSize="small" />
              )}
            </ListItemIcon>
            Light Mode
            {/* <WbSunnyIcon className={classes.themeSwitcher} style={{color: theme.palette.text.primary}} /> */}
          </MenuItem>
          <MenuItem
            className={classes.menuItem}
            onClick={() => {
              props.handleThemeSwitcher(darkTheme);
              handleViewMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.selectedTheme === 'darkTheme' && (
                <CheckIcon fontSize="small" />
              )}
            </ListItemIcon>
            Dark Mode
            {/* <Brightness3Icon className={classes.themeSwitcher} style={{color: theme.palette.text.primary}}/> */}
          </MenuItem>
        </StyledMenu>
        <StyledMenu
          id="tags-menu"
          anchorEl={tagsMenuAnchorEl}
          open={Boolean(tagsMenuAnchorEl)}
          onClose={handleTagsMenuClose}
        >
          <MenuItem
            className={classes.menuItem}
            onClick={() => {
              handleSetTagSortOrder('order');
              handleTagsMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.tagSortOrder === 'order' && (
                <CheckIcon fontSize="small" />
              )}
            </ListItemIcon>
            Sort by User-Defined Order
          </MenuItem>
          <MenuItem
            className={classes.menuItem}
            onClick={() => {
              handleSetTagSortOrder('name');
              handleTagsMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.tagSortOrder === 'name' && (
                <CheckIcon fontSize="small" />
              )}
            </ListItemIcon>
            Sort by Tag Name <ArrowDownwardIcon fontSize="small" />
          </MenuItem>
          <MenuItem
            className={classes.menuItem}
            onClick={() => {
              handleSetTagSortOrder('-name');
              handleTagsMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.tagSortOrder === '-name' && (
                <CheckIcon fontSize="small" />
              )}
            </ListItemIcon>
            Sort by Tag Name <ArrowUpwardIcon fontSize="small" />
          </MenuItem>
          <MenuItem
            className={classes.menuItem}
            onClick={() => {
              handleSetTagSortOrder('-date_created');
              handleTagsMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.tagSortOrder === '-date_created' && (
                <CheckIcon fontSize="small" />
              )}
            </ListItemIcon>
            Sort by Date Created <ArrowDownwardIcon fontSize="small" />
          </MenuItem>
          <MenuItem
            className={classes.menuItem}
            onClick={() => {
              handleSetTagSortOrder('date_created');
              handleTagsMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.tagSortOrder === 'date_created' && (
                <CheckIcon fontSize="small" />
              )}
            </ListItemIcon>
            Sort by Date Created <ArrowUpwardIcon fontSize="small" />
          </MenuItem>
          <MenuItem
            className={classes.menuItem}
            onClick={() => {
              handleSetTagSortOrder('-entry_count');
              handleTagsMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.tagSortOrder === '-entry_count' && (
                <CheckIcon fontSize="small" />
              )}
            </ListItemIcon>
            Sort by Number of Tagged Entries
            <ArrowDownwardIcon fontSize="small" />
          </MenuItem>
          <MenuItem
            className={classes.menuItem}
            onClick={() => {
              handleSetTagSortOrder('entry_count');
              handleTagsMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.tagSortOrder === 'entry_count' && (
                <CheckIcon fontSize="small" />
              )}
            </ListItemIcon>
            Sort by Number of Tagged Entries{' '}
            <ArrowUpwardIcon fontSize="small" />
          </MenuItem>
          <MenuItem
            className={classes.menuItem}
            onClick={() => {
              handleSetTagSortOrder('-date_last_used');
              handleTagsMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.tagSortOrder === '-date_last_used' && (
                <CheckIcon fontSize="small" />
              )}
            </ListItemIcon>
            Sort by Tag recently used
            <ArrowDownwardIcon fontSize="small" />
          </MenuItem>
          <MenuItem
            className={classes.menuItem}
            onClick={() => {
              handleSetTagSortOrder('date_last_used');
              handleTagsMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.tagSortOrder === 'date_last_used' && (
                <CheckIcon fontSize="small" />
              )}
            </ListItemIcon>
            Sort by Tag recently used
            <ArrowUpwardIcon fontSize="small" />
          </MenuItem>
        </StyledMenu>
        <StyledMenu
          id="entries-menu"
          anchorEl={entriesMenuAnchorEl}
          open={Boolean(entriesMenuAnchorEl)}
          onClose={handleEntriesMenuClose}
        >
          <MenuItem
            className={classes.menuItem}
            onClick={() => {
              handleSetEntrySortOrder('order');
              handleEntriesMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.entrySortOrder === 'order' && (
                <CheckIcon fontSize="small" />
              )}
            </ListItemIcon>
            Sort by User-Defined Order
          </MenuItem>
          <MenuItem
            className={classes.menuItem}
            onClick={() => {
              handleSetEntrySortOrder('text_entry__subject');
              handleEntriesMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.entrySortOrder === 'text_entry__subject' && (
                <CheckIcon fontSize="small" />
              )}
            </ListItemIcon>
            Sort by Subject <ArrowDownwardIcon fontSize="small" />
          </MenuItem>
          <MenuItem
            className={classes.menuItem}
            onClick={() => {
              handleSetEntrySortOrder('-text_entry__subject');
              handleEntriesMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.entrySortOrder === '-text_entry__subject' && (
                <CheckIcon fontSize="small" />
              )}
            </ListItemIcon>
            Sort by Subject <ArrowUpwardIcon fontSize="small" />
          </MenuItem>
          <MenuItem
            className={classes.menuItem}
            onClick={() => {
              handleSetEntrySortOrder('text_entry__body');
              handleEntriesMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.entrySortOrder === 'text_entry__body' && (
                <CheckIcon fontSize="small" />
              )}
            </ListItemIcon>
            Sort by Body <ArrowDownwardIcon fontSize="small" />
          </MenuItem>
          <MenuItem
            className={classes.menuItem}
            onClick={() => {
              handleSetEntrySortOrder('-text_entry__body');
              handleEntriesMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.entrySortOrder === '-text_entry__body' && (
                <CheckIcon fontSize="small" />
              )}
            </ListItemIcon>
            Sort by Body <ArrowUpwardIcon fontSize="small" />
          </MenuItem>
          <MenuItem
            className={classes.menuItem}
            onClick={() => {
              handleSetEntrySortOrder('text_entry__date_created');
              handleEntriesMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.entrySortOrder === 'text_entry__date_created' && (
                <CheckIcon fontSize="small" />
              )}
            </ListItemIcon>
            Sort by Date Created <ArrowDownwardIcon fontSize="small" />
          </MenuItem>
          <MenuItem
            className={classes.menuItem}
            onClick={() => {
              handleSetEntrySortOrder('-text_entry__date_created');
              handleEntriesMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.entrySortOrder === '-text_entry__date_created' && (
                <CheckIcon fontSize="small" />
              )}
            </ListItemIcon>
            Sort by Date Created <ArrowUpwardIcon fontSize="small" />
          </MenuItem>
          <MenuItem
            className={classes.menuItem}
            onClick={() => {
              handleSetEntrySortOrder('date_created');
              handleEntriesMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.entrySortOrder === 'date_created' && (
                <CheckIcon fontSize="small" />
              )}
            </ListItemIcon>
            Sort by Date Tagged <ArrowDownwardIcon fontSize="small" />
          </MenuItem>
          <MenuItem
            className={classes.menuItem}
            onClick={() => {
              handleSetEntrySortOrder('-date_created');
              handleEntriesMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.entrySortOrder === '-date_created' && (
                <CheckIcon fontSize="small" />
              )}
            </ListItemIcon>
            Sort by Date Tagged <ArrowUpwardIcon fontSize="small" />
          </MenuItem>
          <MenuItem
            className={classes.menuItem}
            onClick={() => {
              handleSetEntrySortOrder('text_entry__tag_count');
              handleEntriesMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.entrySortOrder === 'text_entry__tag_count' && (
                <CheckIcon fontSize="small" />
              )}
            </ListItemIcon>
            Sort by Tag Count
            <ArrowDownwardIcon fontSize="small" />
          </MenuItem>
          <MenuItem
            className={classes.menuItem}
            onClick={() => {
              handleSetEntrySortOrder('-text_entry__tag_count');
              handleEntriesMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.entrySortOrder === '-text_entry__tag_count' && (
                <CheckIcon fontSize="small" />
              )}
            </ListItemIcon>
            Sort by Tag Count
            <ArrowUpwardIcon fontSize="small" />
          </MenuItem>
        </StyledMenu>
        <StyledMenu
          id="help-menu"
          anchorEl={helpMenuAnchorEl}
          open={Boolean(helpMenuAnchorEl)}
          onClose={handleHelpMenuClose}
        >
          <MenuItem className={classes.menuItem} onClick={handleHelpMenuClose}>
            Help 1
          </MenuItem>
          <MenuItem className={classes.menuItem} onClick={handleHelpMenuClose}>
            Help 2
          </MenuItem>
        </StyledMenu>
      </>
    );
  })
);
export default MenuBar;
