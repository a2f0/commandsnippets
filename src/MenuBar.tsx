import * as Constants from './constants';
import {createStyles, withStyles} from '@material-ui/core/styles';
import {darkTheme, lightTheme} from './themes';
import ArrowDownwardIcon from '@material-ui/icons/ArrowDownward';
import ArrowUpwardIcon from '@material-ui/icons/ArrowUpward';
import Button from '@material-ui/core/Button';
import CheckIcon from '@material-ui/icons/Check';
import Divider from '@material-ui/core/Divider';
import Fade from '@material-ui/core/Fade';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import Menu from '@material-ui/core/Menu';
import React from 'react';
import StyledMenuItem from './StyledMenuItem';
import {Theme} from '@material-ui/core/styles';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import {WithStyles} from '@material-ui/core';
import axios from 'axios';
import {baseHTTPURL} from './api';
import {makeStyles} from '@material-ui/core/styles';
import {observer} from 'mobx-react';
import {useAppContext} from './AppContext';
import {useHistory} from 'react-router-dom';
import {useParams} from 'react-router-dom';

export const MenuStyle = () => {
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

interface IStyledMenuProps extends WithStyles<typeof MenuStyle> {
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

const StyledMenu = withStyles(MenuStyle)(
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

const useStyles = makeStyles({
  drawer: {
    width: Constants.drawerWidth,
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
  themeSwitcher: {
    height: 16,
  },
  dragIndicator: {
    display: 'inline-block',
    width: `${Constants.dragIndicatorWidthTag}px`,
  },
});

interface IMenuBarProps {
  handleThemeSwitcher: (theme: Theme) => void;
}
interface IParamTypes {
  user: string;
}

const MenuBar = (props: IMenuBarProps) => {
  const classes = useStyles();
  const history = useHistory();
  const appConfig = useAppContext();
  const {user} = useParams<IParamTypes>();

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
        appConfig.setLoggedInUser(null);
        setFileMenuAnchorEl(null);
      })
      .catch(() => {})
      .then(() => {});
  };

  const handleFileMenuClick = (event: React.MouseEvent<HTMLButtonElement>) => {
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

  const handleViewMenuClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setViewMenuAnchorEl(event.currentTarget);
  };

  const handleTagsMenuClick = (event: React.MouseEvent<HTMLButtonElement>) => {
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

  const handleSetUntaggedEntrySortOrder = (order: string) => {
    appConfig.setUntaggedEntrySortOrder(order);
  };

  const handleCreateTag = () => {
    setFileMenuAnchorEl(null);
    appConfig.setTagNew('top');
  };

  const handleCreateEntry = () => {
    setFileMenuAnchorEl(null);
    appConfig.setEntryNew('textEntry-top');
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
          <StyledMenuItem onClick={handleCreateTag}>
            Create a Tag
          </StyledMenuItem>
        )}
        {appConfig.loggedInUser && (
          <StyledMenuItem onClick={handleCreateEntry}>
            Create an Entry
          </StyledMenuItem>
        )}
        {!appConfig.loggedInUser && (
          <StyledMenuItem onClick={handleNavigateToLogin}>Login</StyledMenuItem>
        )}
        {appConfig.loggedInUser && (
          <StyledMenuItem onClick={handleLogout}>Logout</StyledMenuItem>
        )}
      </StyledMenu>
      <StyledMenu
        id="edit-menu"
        anchorEl={editMenuAnchorEl}
        open={Boolean(editMenuAnchorEl)}
        onClose={handleEditMenuClose}
      >
        <StyledMenuItem onClick={handleEditMenuClose}>Edit 1</StyledMenuItem>
        <StyledMenuItem onClick={handleEditMenuClose}>Edit 2</StyledMenuItem>
      </StyledMenu>
      <StyledMenu
        id="view-menu"
        anchorEl={viewMenuAnchorEl}
        open={Boolean(viewMenuAnchorEl)}
        onClose={handleViewMenuClose}
      >
        <StyledMenuItem
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
        </StyledMenuItem>
        <StyledMenuItem
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
        </StyledMenuItem>
        <Divider />
        <StyledMenuItem
          onClick={() => {
            appConfig.currentTag
              ? history.push(`/${user}/${appConfig.currentTag}`)
              : history.push(`/${user}`);
            appConfig.setMainPanel('EntryList');
            handleViewMenuClose();
          }}
        >
          <ListItemIcon>
            {appConfig.mainPanel === 'EntryList' && (
              <CheckIcon fontSize="small" />
            )}
          </ListItemIcon>
          Tagged Entries
        </StyledMenuItem>
        <StyledMenuItem
          onClick={() => {
            appConfig.setMainPanel('UntaggedEntryList');
            history.push(`/${user}/untagged`);
            handleViewMenuClose();
          }}
        >
          <ListItemIcon>
            {appConfig.mainPanel === 'UntaggedEntryList' && (
              <CheckIcon fontSize="small" />
            )}
          </ListItemIcon>
          Untagged Entries
        </StyledMenuItem>
        <Divider />
        <StyledMenuItem
          onClick={() => {
            appConfig.setShowTagCounts(!appConfig.showTagCounts);
            handleViewMenuClose();
          }}
        >
          <ListItemIcon>
            {appConfig.showTagCounts === true && <CheckIcon fontSize="small" />}
          </ListItemIcon>
          Show Tag Counts
        </StyledMenuItem>
      </StyledMenu>
      <StyledMenu
        id="tags-menu"
        anchorEl={tagsMenuAnchorEl}
        open={Boolean(tagsMenuAnchorEl)}
        onClose={handleTagsMenuClose}
      >
        <StyledMenuItem
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
        </StyledMenuItem>
        <StyledMenuItem
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
        </StyledMenuItem>
        <StyledMenuItem
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
        </StyledMenuItem>
        <StyledMenuItem
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
        </StyledMenuItem>
        <StyledMenuItem
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
        </StyledMenuItem>
        <StyledMenuItem
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
        </StyledMenuItem>
        <StyledMenuItem
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
          Sort by Number of Tagged Entries <ArrowUpwardIcon fontSize="small" />
        </StyledMenuItem>
        <StyledMenuItem
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
        </StyledMenuItem>
        <StyledMenuItem
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
        </StyledMenuItem>
      </StyledMenu>
      <StyledMenu
        id="entries-menu"
        anchorEl={entriesMenuAnchorEl}
        open={Boolean(entriesMenuAnchorEl)}
        onClose={handleEntriesMenuClose}
      >
        {appConfig.mainPanel === 'EntryList' && [
          <StyledMenuItem
            key="SortMenuItemOrder"
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
          </StyledMenuItem>,
          <StyledMenuItem
            key="SortMenuItemTextEntrySubject"
            onClick={() => {
              handleSetEntrySortOrder('subject');
              handleEntriesMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.entrySortOrder === 'subject' && (
                <CheckIcon fontSize="small" />
              )}
            </ListItemIcon>
            Sort by Subject <ArrowDownwardIcon fontSize="small" />
          </StyledMenuItem>,
          <StyledMenuItem
            key="SortMenuItemTextEntrySubject-"
            onClick={() => {
              handleSetEntrySortOrder('-subject');
              handleEntriesMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.entrySortOrder === '-subject' && (
                <CheckIcon fontSize="small" />
              )}
            </ListItemIcon>
            Sort by Subject <ArrowUpwardIcon fontSize="small" />
          </StyledMenuItem>,
          <StyledMenuItem
            key="SortMenuItemTextEntryBody"
            onClick={() => {
              handleSetEntrySortOrder('body');
              handleEntriesMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.entrySortOrder === 'body' && (
                <CheckIcon fontSize="small" />
              )}
            </ListItemIcon>
            Sort by Body <ArrowDownwardIcon fontSize="small" />
          </StyledMenuItem>,
          <StyledMenuItem
            key="SortMenuItemTextEntryBody-"
            onClick={() => {
              handleSetEntrySortOrder('-body');
              handleEntriesMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.entrySortOrder === '-body' && (
                <CheckIcon fontSize="small" />
              )}
            </ListItemIcon>
            Sort by Body <ArrowUpwardIcon fontSize="small" />
          </StyledMenuItem>,
          <StyledMenuItem
            key="SortMenuItemTextEntryDateCreated"
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
            Sort by Date Created <ArrowDownwardIcon fontSize="small" />
          </StyledMenuItem>,
          <StyledMenuItem
            key="SortMenuItemTextEntryDateCreated-"
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
            Sort by Date Created <ArrowUpwardIcon fontSize="small" />
          </StyledMenuItem>,
          <StyledMenuItem
            key="SortMenuItemTextEntryDateTagged"
            onClick={() => {
              handleSetEntrySortOrder('date_tagged');
              handleEntriesMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.entrySortOrder === 'date_tagged' && (
                <CheckIcon fontSize="small" />
              )}
            </ListItemIcon>
            Sort by Date Tagged <ArrowDownwardIcon fontSize="small" />
          </StyledMenuItem>,
          <StyledMenuItem
            key="SortMenuItemTextEntryDateTagged-"
            onClick={() => {
              handleSetEntrySortOrder('-date_tagged');
              handleEntriesMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.entrySortOrder === '-date_tagged' && (
                <CheckIcon fontSize="small" />
              )}
            </ListItemIcon>
            Sort by Date Tagged <ArrowUpwardIcon fontSize="small" />
          </StyledMenuItem>,
          <StyledMenuItem
            key="SortMenuItemTextEntryTagCount"
            onClick={() => {
              handleSetEntrySortOrder('tag_count');
              handleEntriesMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.entrySortOrder === 'tag_count' && (
                <CheckIcon fontSize="small" />
              )}
            </ListItemIcon>
            Sort by Tag Count
            <ArrowDownwardIcon fontSize="small" />
          </StyledMenuItem>,
          <StyledMenuItem
            key="SortMenuItemTextEntryTagCount-"
            onClick={() => {
              handleSetEntrySortOrder('-tag_count');
              handleEntriesMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.entrySortOrder === '-tag_count' && (
                <CheckIcon fontSize="small" />
              )}
            </ListItemIcon>
            Sort by Tag Count
            <ArrowUpwardIcon fontSize="small" />
          </StyledMenuItem>,
        ]}
        {appConfig.mainPanel === 'UntaggedEntryList' && [
          <StyledMenuItem
            key="SortUntaggedEntryListDateCreated"
            onClick={() => {
              handleSetUntaggedEntrySortOrder('date_created');
              handleEntriesMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.untaggedEntrySortOrder === 'date_created' && (
                <CheckIcon fontSize="small" />
              )}
            </ListItemIcon>
            Sort by Date Created <ArrowDownwardIcon fontSize="small" />
          </StyledMenuItem>,
          <StyledMenuItem
            key="SortUntaggedEntryListDateCreated-"
            onClick={() => {
              handleSetUntaggedEntrySortOrder('date_created');
              handleEntriesMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.untaggedEntrySortOrder === '-date_created' && (
                <CheckIcon fontSize="small" />
              )}
            </ListItemIcon>
            Sort by Date Created <ArrowDownwardIcon fontSize="small" />
          </StyledMenuItem>,
        ]}
      </StyledMenu>
      <StyledMenu
        id="help-menu"
        anchorEl={helpMenuAnchorEl}
        open={Boolean(helpMenuAnchorEl)}
        onClose={handleHelpMenuClose}
      >
        <StyledMenuItem onClick={handleHelpMenuClose}>Help 1</StyledMenuItem>
        <StyledMenuItem onClick={handleHelpMenuClose}>Help 2</StyledMenuItem>
      </StyledMenu>
    </>
  );
};
export default React.memo(observer(MenuBar));
