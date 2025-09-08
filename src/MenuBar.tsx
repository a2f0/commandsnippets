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

const MenuBar = () => {
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
        display="flex"
        flexDirection="row"
        alignItems="flex-end"
        justifyContent="flex-start"
        sx={{
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
        <TagsMenuButton onClick={handleTagsMenuClick} />
        <EntriesMenuButton onClick={handleEntriesMenuClick} />
        {environment !== 'production' && (
          <DebugMenuButton onClick={handleDebugMenuClick} />
        )}
        <HelpMenuButton onClick={handleHelpMenuClick} />
      </Aligner>
      <Box
        display="flex"
        justifyContent="flex-end"
        alignItems="center" // vertically center the items
        flexGrow={1}
        mr={1}
      >
        {!appConfig.loggedInUser && (
          <>
            <GithubAuth />
            <GoogleAuth />
          </>
        )}
        {appConfig.loggedInUser && <UserProfileCircle />}
      </Box>
      <FileMenu onClose={handleFileMenuClose} anchorEl={fileMenuAnchorEl} />
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
