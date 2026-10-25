import {Box} from '@mui/material';
import {styled, useTheme} from '@mui/material/styles';
import React from 'react';
import logoUrl from '../../../../assets/brand/logo.svg?no-inline';
import {UserProfileCircle} from '../components/UserProfileCircle';
import {useTypedTranslation} from '../i18n/hooks';
import {useOwner} from '../lib/data/hooks';
import {environment} from '../lib/environment';
import {SIDEBAR_WIDTH} from '../lib/sidebarWidth';
import {useAppConfig} from '../lib/state/appState';
import {EntriesLinkButton} from './admin/EntriesLinkButton';
import {ModeTabs} from './admin/ModeTabs';
import {ReadOnlyBadge} from './admin/ReadOnlyBadge';
import {DebugMenu} from './debug/DebugMenu';
import {DebugMenuButton} from './debug/DebugMenuButton';
import {EntriesMenu} from './entries/EntriesMenu';
import {EntriesMenuButton} from './entries/EntriesMenuButton';
import {FileMenu} from './file/FileMenu';
import {FileMenuButton} from './file/FileMenuButton';
import {HelpMenu} from './help/HelpMenu';
import {HelpMenuButton} from './help/HelpMenuButton';
import {TagsMenu} from './tags/TagsMenu';
import {TagsMenuButton} from './tags/TagsMenuButton';
import {ViewMenu} from './view/ViewMenu';
import {ViewMenuButton} from './view/ViewMenuButton';

const Aligner = styled('div')`
  align-self: stretch;
  display: flex;
`;

interface IProps {
  /**
   * The Tags and Entries menus and File's New Tag and New Entry act on the
   * entries page; other pages (the admin page) get a way back to it instead:
   * a link, or for staff the User tab of the mode tabs.
   */
  entriesPage?: boolean;
}

const MenuBar = ({entriesPage = true}: IProps) => {
  const appConfig = useAppConfig();
  const {t} = useTypedTranslation('common');
  // Another user's data (staff reading it): shown, never changed.
  const owner = useOwner();
  const readOnly = owner?.readOnly ?? false;

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
          width: entriesPage
            ? `calc(${SIDEBAR_WIDTH} + ${theme.main.dragIndicatorWidth}px)`
            : {xs: 56, sm: theme.drawer.width + theme.main.dragIndicatorWidth},
          alignSelf: 'stretch',
          flexShrink: 0,
          pl: entriesPage ? 2.5 : {xs: 1.5, sm: 2.5},
          pb: 0.5,
        }}
      >
        <Box
          component="svg"
          width={33}
          height={33}
          viewBox="0 0 64 64"
          role="img"
          aria-label={t('logoAlt')}
          sx={{color: 'text.primary'}}
        >
          {/* Reuse the prompt without the favicon's tile or fixed color. */}
          <use href={`${logoUrl}#prompt`} />
        </Box>
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
        {/* Staff go back with the mode tabs instead. */}
        {!entriesPage && appConfig.loggedInUser && !appConfig.isStaff && (
          <EntriesLinkButton username={appConfig.loggedInUser} />
        )}
      </Aligner>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignSelf: 'stretch',
          flexGrow: 1,
          mr: 1,
        }}
      >
        {owner?.readOnly && <ReadOnlyBadge username={owner.owner} />}
        {appConfig.loggedInUser && appConfig.isStaff && (
          <ModeTabs username={appConfig.loggedInUser} readOnly={readOnly} />
        )}
        <Box sx={{display: 'flex', alignItems: 'center', alignSelf: 'center'}}>
          {appConfig.loggedInUser && <UserProfileCircle />}
        </Box>
      </Box>
      <FileMenu
        onClose={handleFileMenuClose}
        anchorEl={fileMenuAnchorEl}
        entriesPage={entriesPage}
        readOnly={readOnly}
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

const memoizedMenuBar = React.memo(MenuBar);

export {memoizedMenuBar as MenuBar};
