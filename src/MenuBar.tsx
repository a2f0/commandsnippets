import * as Constants from './constants';
import {appMode, entrySearchMethod} from './lib/shared';
import {darkTheme, lightTheme} from './themes';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import {AxiosResponse} from 'axios';
import Button from '@mui/material/Button';
import Fade from '@mui/material/Fade';
import GithubAuth from './GithubAuth';
import GoogleAuth from './GoogleAuth';
import {Grid} from '@mui/material';
import {ILogoutJsonApiResponse} from './lib/authentication';
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import React from 'react';
import StyledCheckIcon from './styled/StyledCheckIcon';
import StyledDivider from './styled/StyledDivider';
import StyledMenuItem from './StyledMenuItem';
import {Theme} from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import axios from 'axios';
import {baseHTTPURL} from './api';
import {observer} from 'mobx-react';
import {styled} from '@mui/material/styles';
import {useAppContext} from './AppContext';
import {useTheme} from '@mui/material/styles';

interface IStyledMenuProps {
  id: string;
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const StyledMenu = ({
  id,
  anchorEl,
  open,
  onClose,
  children,
}: IStyledMenuProps) => {
  return (
    <Menu
      id={id}
      anchorEl={anchorEl}
      onClose={onClose}
      transitionDuration={0}
      anchorOrigin={{vertical: 'bottom', horizontal: 'left'}}
      transformOrigin={{vertical: 'top', horizontal: 'left'}}
      keepMounted
      open={open}
      TransitionComponent={Fade}
    >
      {children}
    </Menu>
  );
};

interface AlignerIProps {
  theme: Theme;
}

const Aligner = styled('div')<AlignerIProps>`
  min-height: ${props => props.theme.appBar.height}px;
  display: flex;
`;

const MenuBar = () => {
  const appConfig = useAppContext();

  const [fileMenuAnchorEl, setFileMenuAnchorEl] =
    React.useState<null | HTMLElement>(null);
  const [viewMenuAnchorEl, setViewMenuAnchorEl] =
    React.useState<null | HTMLElement>(null);
  const [entriesMenuAnchorEl, setEntriesMenuAnchorEl] =
    React.useState<null | HTMLElement>(null);
  const [tagsMenuAnchorEl, setTagsMenuAnchorEl] =
    React.useState<null | HTMLElement>(null);

  const theme = useTheme();

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
      .then((response: AxiosResponse<ILogoutJsonApiResponse>) => {
        appConfig.setLoggedInUser(null);
        setFileMenuAnchorEl(null);
        return response;
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
    appConfig.setAppMode(appMode.tagEditor);
    setFileMenuAnchorEl(null);
    appConfig.setTagNew('top');
  };

  const handleCreateEntry = () => {
    setFileMenuAnchorEl(null);
    appConfig.setAppMode(appMode.entryEditor);
    appConfig.setEntryNew('textEntry-top');
  };

  const handleThemeSwitcher = (chosenTheme: Theme) => {
    if (chosenTheme === lightTheme) {
      appConfig.setSelectedTheme('lightTheme');
    } else {
      appConfig.setSelectedTheme('darkTheme');
    }
  };

  return (
    <>
      <Typography
        sx={{
          width: Constants.drawerWidth,
          flexShrink: 0,
        }}
      />
      <Typography
        sx={{
          display: 'inline-block',
          width: `${Constants.dragIndicatorWidthTag}px`,
        }}
      />
      <Aligner theme={theme}>
        {appConfig.loggedInUser && (
          <Button
            color="secondary"
            role="fileMenu"
            size="small"
            aria-controls="file-menu"
            id="file-menu-button"
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
          id="view-menu-button"
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
          aria-controls="tags-menu"
          id="tags-menu-button"
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
          aria-controls="entries-menu"
          id="entries-menu-button"
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
      </Aligner>
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
        <StyledMenuItem id="file-menu-new-tag" onClick={handleCreateTag}>
          New Tag
        </StyledMenuItem>

        <StyledMenuItem id="file-menu-new-entry" onClick={handleCreateEntry}>
          New Entry
        </StyledMenuItem>

        <StyledMenuItem id="file-menu-logout" onClick={handleLogout}>
          Logout
        </StyledMenuItem>
      </StyledMenu>

      <StyledMenu
        id="view-menu"
        anchorEl={viewMenuAnchorEl}
        open={Boolean(viewMenuAnchorEl)}
        onClose={handleViewMenuClose}
      >
        <StyledMenuItem
          id="view-menu-light-theme"
          onClick={() => {
            handleThemeSwitcher(lightTheme);
            handleViewMenuClose();
          }}
        >
          <ListItemIcon>
            {appConfig.selectedTheme === 'lightTheme' && <StyledCheckIcon />}
          </ListItemIcon>
          Light Mode
        </StyledMenuItem>
        <StyledMenuItem
          id="view-menu-dark-theme"
          onClick={() => {
            handleThemeSwitcher(darkTheme);
            handleViewMenuClose();
          }}
        >
          <ListItemIcon>
            {appConfig.selectedTheme === 'darkTheme' && <StyledCheckIcon />}
          </ListItemIcon>
          Dark Mode
        </StyledMenuItem>
        <StyledDivider />
        <StyledMenuItem
          id="view-menu-show-tag-counts"
          onClick={() => {
            appConfig.setShowTagCounts(!appConfig.showTagCounts);
            handleViewMenuClose();
          }}
        >
          <ListItemIcon>
            {appConfig.showTagCounts === true && <StyledCheckIcon />}
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
          id="tags-menu-sort-order"
          onClick={() => {
            handleSetTagSortOrder('order');
            handleTagsMenuClose();
          }}
        >
          <ListItemIcon>
            {appConfig.tagSortOrder === 'order' && <StyledCheckIcon />}
          </ListItemIcon>
          Sort by User-Defined Order
        </StyledMenuItem>
        <StyledMenuItem
          id="tags-menu-sort-name-descending"
          onClick={() => {
            handleSetTagSortOrder('name');
            handleTagsMenuClose();
          }}
        >
          <ListItemIcon>
            {appConfig.tagSortOrder === 'name' && <StyledCheckIcon />}
          </ListItemIcon>
          Sort by Tag Name <ArrowDownwardIcon fontSize="small" />
        </StyledMenuItem>
        <StyledMenuItem
          id="tags-menu-sort-name-ascending"
          onClick={() => {
            handleSetTagSortOrder('-name');
            handleTagsMenuClose();
          }}
        >
          <ListItemIcon>
            {appConfig.tagSortOrder === '-name' && <StyledCheckIcon />}
          </ListItemIcon>
          Sort by Tag Name <ArrowUpwardIcon fontSize="small" />
        </StyledMenuItem>
        <StyledMenuItem
          id="tags-menu-sort-date-created-descending"
          onClick={() => {
            handleSetTagSortOrder('-date_created');
            handleTagsMenuClose();
          }}
        >
          <ListItemIcon>
            {appConfig.tagSortOrder === '-date_created' && <StyledCheckIcon />}
          </ListItemIcon>
          Sort by Date Created <ArrowDownwardIcon fontSize="small" />
        </StyledMenuItem>
        <StyledMenuItem
          id="tags-menu-sort-date-created-ascending"
          onClick={() => {
            handleSetTagSortOrder('date_created');
            handleTagsMenuClose();
          }}
        >
          <ListItemIcon>
            {appConfig.tagSortOrder === 'date_created' && <StyledCheckIcon />}
          </ListItemIcon>
          Sort by Date Created <ArrowUpwardIcon fontSize="small" />
        </StyledMenuItem>
        <StyledMenuItem
          id="tags-menu-sort-entry-count-descending"
          onClick={() => {
            handleSetTagSortOrder('-entry_count');
            handleTagsMenuClose();
          }}
        >
          <ListItemIcon>
            {appConfig.tagSortOrder === '-entry_count' && <StyledCheckIcon />}
          </ListItemIcon>
          Sort by Number of Tagged Entries
          <ArrowDownwardIcon fontSize="small" />
        </StyledMenuItem>
        <StyledMenuItem
          id="tags-menu-sort-entry-count-ascending"
          onClick={() => {
            handleSetTagSortOrder('entry_count');
            handleTagsMenuClose();
          }}
        >
          <ListItemIcon>
            {appConfig.tagSortOrder === 'entry_count' && <StyledCheckIcon />}
          </ListItemIcon>
          Sort by Number of Tagged Entries <ArrowUpwardIcon fontSize="small" />
        </StyledMenuItem>
        <StyledMenuItem
          id="tags-menu-sort-date-last-used-descending"
          onClick={() => {
            handleSetTagSortOrder('-date_last_used');
            handleTagsMenuClose();
          }}
        >
          <ListItemIcon>
            {appConfig.tagSortOrder === '-date_last_used' && (
              <StyledCheckIcon />
            )}
          </ListItemIcon>
          Sort by Tag recently used
          <ArrowDownwardIcon fontSize="small" />
        </StyledMenuItem>
        <StyledMenuItem
          id="tags-menu-sort-date-last-used-ascending"
          onClick={() => {
            handleSetTagSortOrder('date_last_used');
            handleTagsMenuClose();
          }}
        >
          <ListItemIcon>
            {appConfig.tagSortOrder === 'date_last_used' && <StyledCheckIcon />}
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
          id={`entries-menu-list-method-${entrySearchMethod.allEntries}`}
          onClick={() => {
            appConfig.setEntrySearchMethod(entrySearchMethod.allEntries);
            handleEntriesMenuClose();
          }}
        >
          <ListItemIcon>
            {appConfig.entrySearchMethod === entrySearchMethod.allEntries && (
              <StyledCheckIcon />
            )}
          </ListItemIcon>
          All entries
        </StyledMenuItem>
        <StyledMenuItem
          id={`entries-menu-list-method-${entrySearchMethod.currentTagOnly}`}
          onClick={() => {
            appConfig.setEntrySearchMethod(entrySearchMethod.currentTagOnly);
            handleEntriesMenuClose();
          }}
        >
          <ListItemIcon>
            {appConfig.entrySearchMethod ===
              entrySearchMethod.currentTagOnly && <StyledCheckIcon />}
          </ListItemIcon>
          Current tag
        </StyledMenuItem>
        <StyledMenuItem
          id={`entries-menu-list-method-${entrySearchMethod.untaggedEntryList}`}
          onClick={() => {
            appConfig.setEntrySearchMethod(entrySearchMethod.untaggedEntryList);
            handleEntriesMenuClose();
          }}
        >
          <ListItemIcon>
            {appConfig.entrySearchMethod ===
              entrySearchMethod.untaggedEntryList && <StyledCheckIcon />}
          </ListItemIcon>
          Untagged Entries
        </StyledMenuItem>
        <StyledDivider />
        {appConfig.entrySearchMethod === entrySearchMethod.currentTagOnly && [
          <StyledMenuItem
            id="tagged-entries-menu-sort-order"
            key="SortMenuItemOrder"
            onClick={() => {
              appConfig.setTagTextEntryThroughModelSortOrder('order');
              handleEntriesMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.tagTextEntryThroughModelSortOrder === 'order' && (
                <StyledCheckIcon />
              )}
            </ListItemIcon>
            Sort by User-Defined Order
          </StyledMenuItem>,
          <StyledMenuItem
            id="tagged-entries-menu-sort-subject-ascending"
            key="SortMenuItemTextEntrySubject"
            onClick={() => {
              appConfig.setTagTextEntryThroughModelSortOrder('subject');
              handleEntriesMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.tagTextEntryThroughModelSortOrder === 'subject' && (
                <StyledCheckIcon />
              )}
            </ListItemIcon>
            Sort by Subject <ArrowDownwardIcon fontSize="small" />
          </StyledMenuItem>,
          <StyledMenuItem
            id="tagged-entries-menu-sort-subject-descending"
            key="SortMenuItemTextEntrySubject-"
            onClick={() => {
              appConfig.setTagTextEntryThroughModelSortOrder('-subject');
              handleEntriesMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.tagTextEntryThroughModelSortOrder === '-subject' && (
                <StyledCheckIcon />
              )}
            </ListItemIcon>
            Sort by Subject <ArrowUpwardIcon fontSize="small" />
          </StyledMenuItem>,
          <StyledMenuItem
            id="tagged-entries-menu-sort-body-ascending"
            key="SortMenuItemTextEntryBody"
            onClick={() => {
              appConfig.setTagTextEntryThroughModelSortOrder('body');
              handleEntriesMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.tagTextEntryThroughModelSortOrder === 'body' && (
                <StyledCheckIcon />
              )}
            </ListItemIcon>
            Sort by Body <ArrowDownwardIcon fontSize="small" />
          </StyledMenuItem>,
          <StyledMenuItem
            id="tagged-entries-menu-sort-body-descending"
            key="SortMenuItemTextEntryBody-"
            onClick={() => {
              appConfig.setTagTextEntryThroughModelSortOrder('-body');
              handleEntriesMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.tagTextEntryThroughModelSortOrder === '-body' && (
                <StyledCheckIcon />
              )}
            </ListItemIcon>
            Sort by Body <ArrowUpwardIcon fontSize="small" />
          </StyledMenuItem>,
          <StyledMenuItem
            id="tagged-entries-menu-sort-date-created-ascending"
            key="SortMenuItemTextEntryDateCreated"
            onClick={() => {
              appConfig.setTagTextEntryThroughModelSortOrder('date_created');
              handleEntriesMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.tagTextEntryThroughModelSortOrder ===
                'date_created' && <StyledCheckIcon />}
            </ListItemIcon>
            Sort by Date Created <ArrowDownwardIcon fontSize="small" />
          </StyledMenuItem>,
          <StyledMenuItem
            id="tagged-entries-menu-sort-date-created-descending"
            key="SortMenuItemTextEntryDateCreated-"
            onClick={() => {
              appConfig.setTagTextEntryThroughModelSortOrder('-date_created');
              handleEntriesMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.tagTextEntryThroughModelSortOrder ===
                '-date_created' && <StyledCheckIcon />}
            </ListItemIcon>
            Sort by Date Created <ArrowUpwardIcon fontSize="small" />
          </StyledMenuItem>,
          <StyledMenuItem
            id="tagged-entries-menu-sort-date-tagged-ascending"
            key="SortMenuItemTextEntryDateTagged"
            onClick={() => {
              appConfig.setTagTextEntryThroughModelSortOrder('date_tagged');
              handleEntriesMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.tagTextEntryThroughModelSortOrder ===
                'date_tagged' && <StyledCheckIcon />}
            </ListItemIcon>
            Sort by Date Tagged <ArrowDownwardIcon fontSize="small" />
          </StyledMenuItem>,
          <StyledMenuItem
            id="tagged-entries-menu-sort-date-tagged-descending"
            key="SortMenuItemTextEntryDateTagged-"
            onClick={() => {
              appConfig.setTagTextEntryThroughModelSortOrder('-date_tagged');
              handleEntriesMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.tagTextEntryThroughModelSortOrder ===
                '-date_tagged' && <StyledCheckIcon />}
            </ListItemIcon>
            Sort by Date Tagged <ArrowUpwardIcon fontSize="small" />
          </StyledMenuItem>,
          <StyledMenuItem
            id="tagged-entries-menu-sort-date-tag-count-ascending"
            key="SortMenuItemTextEntryTagCount"
            onClick={() => {
              appConfig.setTagTextEntryThroughModelSortOrder('tag_count');
              handleEntriesMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.tagTextEntryThroughModelSortOrder === 'tag_count' && (
                <StyledCheckIcon />
              )}
            </ListItemIcon>
            Sort by Tag Count
            <ArrowDownwardIcon fontSize="small" />
          </StyledMenuItem>,
          <StyledMenuItem
            id="tagged-entries-menu-sort-date-tag-count-descending"
            key="SortMenuItemTextEntryTagCount-"
            onClick={() => {
              appConfig.setTagTextEntryThroughModelSortOrder('-tag_count');
              handleEntriesMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.tagTextEntryThroughModelSortOrder === '-tag_count' && (
                <StyledCheckIcon />
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
            id="entries-menu-sort-date-tag-count-descending"
            onClick={() => {
              appConfig.setEntrySortOrder('date_created');
              handleEntriesMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.entrySortOrder === 'date_created' && (
                <StyledCheckIcon />
              )}
            </ListItemIcon>
            Sort by Date Created <ArrowDownwardIcon fontSize="small" />
          </StyledMenuItem>,
          <StyledMenuItem
            id="entries-menu-sort-date-tag-count-descending"
            key="SortUntaggedEntryListDateCreated-"
            onClick={() => {
              appConfig.setEntrySortOrder('-date_created');
              handleEntriesMenuClose();
            }}
          >
            <ListItemIcon>
              {appConfig.entrySortOrder === '-date_created' && (
                <StyledCheckIcon />
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
