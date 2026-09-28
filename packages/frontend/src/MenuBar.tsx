import {Box, Fade, Menu} from '@mui/material';
import {styled, useTheme} from '@mui/material/styles';
import {observer} from 'mobx-react';
import React from 'react';

import {useAppContext} from './AppContext';
import {UserProfileCircle} from './components/UserProfileCircle';
import {GithubAuth} from './GithubAuth';
import {GoogleAuth} from './GoogleAuth';
import {useTypedTranslation} from './i18n/hooks';
import {environment} from './lib/environment';
import {AdminLinkButton} from './menu/admin/AdminLinkButton';
import {EntriesLinkButton} from './menu/admin/EntriesLinkButton';
import {DebugMenu} from './menu/debug/DebugMenu';
import {DebugMenuButton} from './menu/debug/DebugMenuButton';
import {EntriesMenu} from './menu/entries/EntriesMenu';
import {EntriesMenuButton} from './menu/entries/EntriesMenuButton';
import {FileMenu} from './menu/file/FileMenu';
import {FileMenuButton} from './menu/file/FileMenuButton';
import {HelpMenu} from './menu/help/HelpMenu';
import {HelpMenuButton} from './menu/help/HelpMenuButton';
import {TagsMenu} from './menu/tags/TagsMenu';
import {TagsMenuButton} from './menu/tags/TagsMenuButton';
import {ViewMenu} from './menu/view/ViewMenu';
import {ViewMenuButton} from './menu/view/ViewMenuButton';

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
      slots={{transition: Fade}}
    >
      {children}
    </Menu>
  );
};

const Aligner = styled('div')`
  min-height: ${props => props.theme.appBar.height}px;
  display: flex;
`;

interface IProps {
  /**
   * The Tags and Entries menus and File's New Tag and New Entry act on the
   * entries page; other pages (the admin page) get a link back to it instead.
   */
  entriesPage?: boolean;
}

const MenuBar = ({entriesPage = true}: IProps) => {
  const appConfig = useAppContext();
  const {t} = useTypedTranslation('common');

  const [fileMenuAnchorEl, setFileMenuAnchorEl] =
    React.useState<null | HTMLElement>(null);
  const [viewMenuAnchorEl, setViewMenuAnchorEl] =
    React.useState<null | HTMLElement>(null);
  const [entriesMenuAnchorEl, setEntriesMenuAnchorEl] =
    React.useState<null | HTMLElement>(null);
  const [tagsMenuAnchorEl, setTagsMenuAnchorEl] =
    React.useState<null | HTMLElement>(null);
  const [debugMenuAnchorEl, setDebugMenuAnchorEl] =
    React.useState<null | HTMLElement>(null);
  const [helpMenuAnchorEl, setHelpMenuAnchorEl] =
    React.useState<null | HTMLElement>(null);

  const theme = useTheme();

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

  const handleDebugMenuClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setDebugMenuAnchorEl(event.currentTarget);
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

  const handleDebugMenuClose = () => {
    setDebugMenuAnchorEl(null);
  };

  const handleHelpMenuClose = () => {
    setHelpMenuAnchorEl(null);
  };

  return (
    <>
      <Box
        id="menuBarDrawerSpacer"
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'flex-start',
          width: `calc(${theme.drawer.width}px + ${theme.main.dragIndicatorWidth}px)`,
          height: theme.appBar.height,
          flexShrink: 0,
          pl: 2.5,
          pb: 0.5,
        }}
      >
        <img src="/tearleads-logo-small.svg" alt={t('logoAlt')} />
      </Box>
      <Aligner>
        {appConfig.loggedInUser && (
          <FileMenuButton onClick={handleFileMenuClick} />
        )}
        <ViewMenuButton onClick={handleViewMenuClick} />
        {entriesPage && <TagsMenuButton onClick={handleTagsMenuClick} />}
        {entriesPage && <EntriesMenuButton onClick={handleEntriesMenuClick} />}
        {environment !== 'production' && (
          <DebugMenuButton onClick={handleDebugMenuClick} />
        )}
        <HelpMenuButton onClick={handleHelpMenuClick} />
        {!entriesPage && appConfig.loggedInUser && (
          <EntriesLinkButton username={appConfig.loggedInUser} />
        )}
        {appConfig.loggedInUser && appConfig.isStaff && <AdminLinkButton />}
      </Aligner>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          flexGrow: 1,
          mr: 1,
        }}
      >
        {!appConfig.loggedInUser && (
          <>
            <GithubAuth />
            <GoogleAuth />
          </>
        )}
        {appConfig.loggedInUser && <UserProfileCircle />}
      </Box>
      <FileMenu
        onClose={handleFileMenuClose}
        anchorEl={fileMenuAnchorEl}
        entriesPage={entriesPage}
      />
      <ViewMenu onClose={handleViewMenuClose} anchorEl={viewMenuAnchorEl} />
      <TagsMenu onClose={handleTagsMenuClose} anchorEl={tagsMenuAnchorEl} />
      <EntriesMenu
        onClose={handleEntriesMenuClose}
        anchorEl={entriesMenuAnchorEl}
      />
      <DebugMenu onClose={handleDebugMenuClose} anchorEl={debugMenuAnchorEl} />
      <HelpMenu onClose={handleHelpMenuClose} anchorEl={helpMenuAnchorEl} />
    </>
  );
};

const memoizedMenuBar = React.memo(observer(MenuBar));

export {memoizedMenuBar as MenuBar};
