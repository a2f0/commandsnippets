import {appMode, entrySearchMethod} from './lib/shared';
import {darkTheme, lightTheme} from './themes';
import {useNavigate, useParams, useSearchParams} from 'react-router-dom';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import {AxiosResponse} from 'axios';
import Box from '@mui/material/Box';
import Fade from '@mui/material/Fade';
import GithubAuth from './GithubAuth';
import GoogleAuth from './GoogleAuth';
import {Grid} from '@mui/material';
import HelpMenu from './menu/help/HelpMenu';
import HelpMenuButton from './menu/help/HelpMenuButton';
import {ILogoutJsonApiResponse} from './lib/authentication';
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import MenuBarButton from './MenuBarButton';
import React from 'react';
import StyledCheckIcon from './styled/StyledCheckIcon';
import StyledDivider from './styled/StyledDivider';
import StyledMenuItem from './StyledMenuItem';
import {Theme} from '@mui/material/styles';
import axios from 'axios';
import {baseHTTPURL} from './apiBase';
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

export const StyledMenu = ({
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
  const {user} = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const entriesFilter = searchParams.get('entries');

  const [fileMenuAnchorEl, setFileMenuAnchorEl] =
    React.useState<null | HTMLElement>(null);
  const [viewMenuAnchorEl, setViewMenuAnchorEl] =
    React.useState<null | HTMLElement>(null);
  const [entriesMenuAnchorEl, setEntriesMenuAnchorEl] =
    React.useState<null | HTMLElement>(null);
  const [tagsMenuAnchorEl, setTagsMenuAnchorEl] =
    React.useState<null | HTMLElement>(null);
  const [helpMenuAnchorEl, setHelpMenuAnchorEl] =
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

  const handleHelpMenuClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setHelpMenuAnchorEl(event.currentTarget);
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

  const handleHelpMenuClose = () => {
    setHelpMenuAnchorEl(null);
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
      <Box
        id="menuBarDrawerSpacer"
        sx={{
          width: `calc(${theme.drawer.width}px + ${theme.main.dragIndicatorWidth}px)`,
          flexShrink: 0,
        }}
      />
      <Aligner theme={theme}>
        {appConfig.loggedInUser && (
          <MenuBarButton
            id="file-menu-button"
            ariaControls="file-menu"
            ariaLabel="File"
            onClick={handleFileMenuClick}
          >
            File
          </MenuBarButton>
        )}
        <MenuBarButton
          id="view-menu-button"
          ariaControls="view-menu"
          ariaLabel="View"
          onClick={handleViewMenuClick}
        >
          View
        </MenuBarButton>
        <MenuBarButton
          id="tags-menu-button"
          ariaControls="tags-menu"
          ariaLabel="Tags"
          onClick={handleTagsMenuClick}
        >
          Tags
        </MenuBarButton>
        <MenuBarButton
          id="entries-menu-button"
          ariaControls="entries-menu"
          ariaLabel="Entries"
          onClick={handleEntriesMenuClick}
        >
          Entries
        </MenuBarButton>
        <HelpMenuButton onClick={handleHelpMenuClick} />
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
            handleEntriesMenuClose();
            if (user !== undefined) {
              navigate(`/${user}?entries=all`);
            }
          }}
        >
          <ListItemIcon>
            {entriesFilter === 'all' && <StyledCheckIcon />}
          </ListItemIcon>
          All entries
        </StyledMenuItem>
        <StyledMenuItem
          id={`entries-menu-list-method-${entrySearchMethod.untaggedEntryList}`}
          onClick={() => {
            if (user !== undefined) {
              navigate(`/${user}?entries=untagged`);
            }
            handleEntriesMenuClose();
          }}
        >
          <ListItemIcon>
            {entriesFilter === 'untagged' && <StyledCheckIcon />}
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
      <HelpMenu onClose={handleHelpMenuClose} anchorEl={helpMenuAnchorEl} />
    </>
  );
};
export default React.memo(observer(MenuBar));
