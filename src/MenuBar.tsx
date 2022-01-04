import * as Constants from './constants';
import {darkTheme, lightTheme} from './themes';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import Button from '@mui/material/Button';
import CheckIcon from '@mui/icons-material/Check';
import Divider from '@mui/material/Divider';
import Fade from '@mui/material/Fade';
import GithubAuth from './GithubAuth';
import GoogleAuth from './GoogleAuth';
import {Grid} from '@mui/material';
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import React from 'react';
import StyledMenuItem from './StyledMenuItem';
import {Theme} from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import {WithStyles} from '@mui/styles';
import axios from 'axios';
import {baseHTTPURL} from './api';
import createStyles from '@mui/styles/createStyles';
import {entrySearchMethod} from './lib/shared';
import makeStyles from '@mui/styles/makeStyles';
import {observer} from 'mobx-react';
import {useAppContext} from './AppContext';
import {useNavigate} from 'react-router-dom';
import {useParams} from 'react-router-dom';
import withStyles from '@mui/styles/withStyles';

export const MenuStyle = () => {
  return createStyles({
    paper: {
      margin: 0,
      // Remove the Material UI gradient.
      backgroundImage: 'none',
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
  children: React.ReactNode;
}

const StyledMenu = withStyles(MenuStyle)(
  ({id, anchorEl, open, onClose, classes, children}: IStyledMenuProps) => {
    return (
      <Menu
        id={id}
        anchorEl={anchorEl}
        onClose={onClose}
        transitionDuration={0}
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
  dragIndicator: {
    display: 'inline-block',
    width: `${Constants.dragIndicatorWidthTag}px`,
  },
  aligner: {
    minHeight: `${Constants.appBarHeight}px`,
    display: 'flex',
  },
});

interface IMenuBarProps {
  handleThemeSwitcher: (theme: Theme) => void;
}

const MenuBar = (props: IMenuBarProps) => {
  const classes = useStyles();
  const navigate = useNavigate();
  const appConfig = useAppContext();
  const {user} = useParams();

  const [fileMenuAnchorEl, setFileMenuAnchorEl] =
    React.useState<null | HTMLElement>(null);
  const [viewMenuAnchorEl, setViewMenuAnchorEl] =
    React.useState<null | HTMLElement>(null);
  const [entriesMenuAnchorEl, setEntriesMenuAnchorEl] =
    React.useState<null | HTMLElement>(null);
  const [tagsMenuAnchorEl, setTagsMenuAnchorEl] =
    React.useState<null | HTMLElement>(null);

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

  const handleSetTagSortOrder = (order: string) => {
    appConfig.setTagSortOrder(order);
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
      <Typography className={classes.drawer}></Typography>
      <Typography className={classes.dragIndicator}></Typography>
      <div className={classes.aligner}>
        {appConfig.loggedInUser && (
          <Button
            color="secondary"
            size="small"
            aria-controls="file-menu"
            aria-haspopup="true"
            onClick={handleFileMenuClick}
            sx={{
              alignSelf: 'flex-end',
              textTransform: 'none',
              padding: 0,
              minWidth: 0,
              marginRight: 2,
              '&:hover': {
                color: theme => `${theme.header.menuButtonHighlight}`,
                background: 'none',
              },
              '&:active': {
                backgroundColor: '#585858',
              },
            }}
          >
            File
          </Button>
        )}
        <Button
          color="secondary"
          size="small"
          aria-controls="view-menu"
          aria-haspopup="true"
          onClick={handleViewMenuClick}
          sx={{
            alignSelf: 'flex-end',
            textTransform: 'none',
            padding: 0,
            minWidth: 0,
            marginRight: 2,
            '&:hover': {
              color: theme => `${theme.header.menuButtonHighlight}`,
              background: 'none',
            },
            '&:active': {
              backgroundColor: '#585858',
            },
          }}
        >
          View
        </Button>
        <Button
          color="secondary"
          size="small"
          aria-controls="view-menu"
          aria-haspopup="true"
          onClick={handleTagsMenuClick}
          sx={{
            alignSelf: 'flex-end',
            textTransform: 'none',
            padding: 0,
            minWidth: 0,
            marginRight: 2,
            '&:hover': {
              color: theme => `${theme.header.menuButtonHighlight}`,
              background: 'none',
            },
            '&:active': {
              backgroundColor: '#585858',
            },
          }}
        >
          Tags
        </Button>
        <Button
          color="secondary"
          size="small"
          aria-controls="view-menu"
          aria-haspopup="true"
          onClick={handleEntriesMenuClick}
          sx={{
            alignSelf: 'flex-end',
            textTransform: 'none',
            padding: 0,
            minWidth: 0,
            marginRight: 2,
            '&:hover': {
              color: theme => `${theme.header.menuButtonHighlight}`,
              background: 'none',
            },
            '&:active': {
              backgroundColor: '#585858',
            },
          }}
        >
          Entries
        </Button>
      </div>
      <Grid container justifyContent="flex-end">
        <GithubAuth />
        <GoogleAuth />
      </Grid>

      <StyledMenu
        id="file-menu"
        anchorEl={fileMenuAnchorEl}
        open={Boolean(fileMenuAnchorEl)}
        onClose={handleFileMenuClose}
      >
        <StyledMenuItem onClick={handleCreateTag}>New Tag</StyledMenuItem>

        <StyledMenuItem onClick={handleCreateEntry}>New Entry</StyledMenuItem>

        <StyledMenuItem onClick={handleLogout}>Logout</StyledMenuItem>
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
        <StyledMenuItem
          onClick={() => {
            appConfig.setEntrySearchMethod(entrySearchMethod.allEntries);
            handleEntriesMenuClose();
          }}
        >
          <ListItemIcon>
            {appConfig.entrySearchMethod === entrySearchMethod.allEntries && (
              <CheckIcon fontSize="small" />
            )}
          </ListItemIcon>
          All entries
        </StyledMenuItem>
        <StyledMenuItem
          onClick={() => {
            appConfig.setEntrySearchMethod(entrySearchMethod.currentTagOnly);
            handleEntriesMenuClose();
          }}
        >
          <ListItemIcon>
            {appConfig.entrySearchMethod ===
              entrySearchMethod.currentTagOnly && (
              <CheckIcon fontSize="small" />
            )}
          </ListItemIcon>
          Current tag
        </StyledMenuItem>
        <StyledMenuItem
          onClick={() => {
            appConfig.setEntrySearchMethod(entrySearchMethod.untaggedEntryList);
            handleEntriesMenuClose();
          }}
        >
          <ListItemIcon>
            {appConfig.entrySearchMethod ===
              entrySearchMethod.untaggedEntryList && (
              <CheckIcon fontSize="small" />
            )}
          </ListItemIcon>
          Untagged Entries
        </StyledMenuItem>
        <Divider />
        {appConfig.entrySearchMethod === entrySearchMethod.currentTagOnly && [
          <StyledMenuItem
            key="SortMenuItemOrder"
            onClick={() => {
              appConfig.setTagTextEntryThroughModelSortOrder('order');
              handleEntriesMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.tagTextEntryThroughModelSortOrder === 'order' && (
                <CheckIcon fontSize="small" />
              )}
            </ListItemIcon>
            Sort by User-Defined Order
          </StyledMenuItem>,
          <StyledMenuItem
            key="SortMenuItemTextEntrySubject"
            onClick={() => {
              appConfig.setTagTextEntryThroughModelSortOrder('subject');
              handleEntriesMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.tagTextEntryThroughModelSortOrder === 'subject' && (
                <CheckIcon fontSize="small" />
              )}
            </ListItemIcon>
            Sort by Subject <ArrowDownwardIcon fontSize="small" />
          </StyledMenuItem>,
          <StyledMenuItem
            key="SortMenuItemTextEntrySubject-"
            onClick={() => {
              appConfig.setTagTextEntryThroughModelSortOrder('-subject');
              handleEntriesMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.tagTextEntryThroughModelSortOrder === '-subject' && (
                <CheckIcon fontSize="small" />
              )}
            </ListItemIcon>
            Sort by Subject <ArrowUpwardIcon fontSize="small" />
          </StyledMenuItem>,
          <StyledMenuItem
            key="SortMenuItemTextEntryBody"
            onClick={() => {
              appConfig.setTagTextEntryThroughModelSortOrder('body');
              handleEntriesMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.tagTextEntryThroughModelSortOrder === 'body' && (
                <CheckIcon fontSize="small" />
              )}
            </ListItemIcon>
            Sort by Body <ArrowDownwardIcon fontSize="small" />
          </StyledMenuItem>,
          <StyledMenuItem
            key="SortMenuItemTextEntryBody-"
            onClick={() => {
              appConfig.setTagTextEntryThroughModelSortOrder('-body');
              handleEntriesMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.tagTextEntryThroughModelSortOrder === '-body' && (
                <CheckIcon fontSize="small" />
              )}
            </ListItemIcon>
            Sort by Body <ArrowUpwardIcon fontSize="small" />
          </StyledMenuItem>,
          <StyledMenuItem
            key="SortMenuItemTextEntryDateCreated"
            onClick={() => {
              appConfig.setTagTextEntryThroughModelSortOrder('date_created');
              handleEntriesMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.tagTextEntryThroughModelSortOrder ===
                'date_created' && <CheckIcon fontSize="small" />}
            </ListItemIcon>
            Sort by Date Created <ArrowDownwardIcon fontSize="small" />
          </StyledMenuItem>,
          <StyledMenuItem
            key="SortMenuItemTextEntryDateCreated-"
            onClick={() => {
              appConfig.setTagTextEntryThroughModelSortOrder('-date_created');
              handleEntriesMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.tagTextEntryThroughModelSortOrder ===
                '-date_created' && <CheckIcon fontSize="small" />}
            </ListItemIcon>
            Sort by Date Created <ArrowUpwardIcon fontSize="small" />
          </StyledMenuItem>,
          <StyledMenuItem
            key="SortMenuItemTextEntryDateTagged"
            onClick={() => {
              appConfig.setTagTextEntryThroughModelSortOrder('date_tagged');
              handleEntriesMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.tagTextEntryThroughModelSortOrder ===
                'date_tagged' && <CheckIcon fontSize="small" />}
            </ListItemIcon>
            Sort by Date Tagged <ArrowDownwardIcon fontSize="small" />
          </StyledMenuItem>,
          <StyledMenuItem
            key="SortMenuItemTextEntryDateTagged-"
            onClick={() => {
              appConfig.setTagTextEntryThroughModelSortOrder('-date_tagged');
              handleEntriesMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.tagTextEntryThroughModelSortOrder ===
                '-date_tagged' && <CheckIcon fontSize="small" />}
            </ListItemIcon>
            Sort by Date Tagged <ArrowUpwardIcon fontSize="small" />
          </StyledMenuItem>,
          <StyledMenuItem
            key="SortMenuItemTextEntryTagCount"
            onClick={() => {
              appConfig.setTagTextEntryThroughModelSortOrder('tag_count');
              handleEntriesMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.tagTextEntryThroughModelSortOrder === 'tag_count' && (
                <CheckIcon fontSize="small" />
              )}
            </ListItemIcon>
            Sort by Tag Count
            <ArrowDownwardIcon fontSize="small" />
          </StyledMenuItem>,
          <StyledMenuItem
            key="SortMenuItemTextEntryTagCount-"
            onClick={() => {
              appConfig.setTagTextEntryThroughModelSortOrder('-tag_count');
              handleEntriesMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.tagTextEntryThroughModelSortOrder === '-tag_count' && (
                <CheckIcon fontSize="small" />
              )}
            </ListItemIcon>
            Sort by Tag Count
            <ArrowUpwardIcon fontSize="small" />
          </StyledMenuItem>,
        ]}
        {(appConfig.entrySearchMethod === entrySearchMethod.allEntries ||
          appConfig.entrySearchMethod ===
            entrySearchMethod.untaggedEntryList) && [
          <StyledMenuItem
            key="SortUntaggedEntryListDateCreated"
            onClick={() => {
              appConfig.setEntrySortOrder('date_created');
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
            key="SortUntaggedEntryListDateCreated-"
            onClick={() => {
              appConfig.setEntrySortOrder('-date_created');
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
        ]}
      </StyledMenu>
    </>
  );
};
export default React.memo(observer(MenuBar));
