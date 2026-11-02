import {Box} from '@mui/material';
import {styled, useTheme} from '@mui/material/styles';
import React from 'react';
import logoUrl from '../../../../assets/brand/logo.svg?no-inline';
import {UserProfileCircle} from '../components/UserProfileCircle';
import {useTypedTranslation} from '../i18n/hooks';
import {useOwner} from '../lib/data/hooks';
import {canOverrideFeatureFlags} from '../lib/featureFlags/featureFlags';
import {SIDEBAR_WIDTH} from '../lib/sidebarWidth';
import {useAppConfig} from '../lib/state/appState';
import {EntriesLinkButton} from './admin/EntriesLinkButton';
import {ModeTabs} from './admin/ModeTabs';
import {ReadOnlyBadge} from './admin/ReadOnlyBadge';
import {DebugMenu} from './debug/DebugMenu';
import {EntriesMenu} from './entries/EntriesMenu';
import {FileMenu} from './file/FileMenu';
import {HelpMenu} from './help/HelpMenu';
import {MenuBarButton} from './MenuBarButton';
import {TagsMenu} from './tags/TagsMenu';
import {ViewMenu} from './view/ViewMenu';

type MenuName = 'file' | 'view' | 'tags' | 'entries' | 'debug' | 'help';

/** The menu bar's menus, in order: each one's button and drop-down ids. */
const MENUS: readonly {name: MenuName; buttonId: string; menuId: string}[] = [
  {name: 'file', buttonId: 'file-menu-button', menuId: 'file-menu'},
  {name: 'view', buttonId: 'view-menu-button', menuId: 'view-menu'},
  {name: 'tags', buttonId: 'tags-menu-button', menuId: 'tags-menu'},
  {name: 'entries', buttonId: 'entries-menu-button', menuId: 'entries-menu'},
  {name: 'debug', buttonId: 'debug-menu-button', menuId: 'debug-menu'},
  {name: 'help', buttonId: 'helpMenuButton', menuId: 'help-menu'},
];

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

const Logo = () => {
  const {t} = useTypedTranslation('common');
  return (
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
  );
};

const MenuBar = ({entriesPage = true}: IProps) => {
  const appConfig = useAppConfig();
  const {t} = useTypedTranslation('menu');
  // Another user's data (staff reading it): shown, never changed.
  const owner = useOwner();
  const readOnly = owner?.readOnly ?? false;
  const theme = useTheme();
  const [open, setOpen] = React.useState<{
    menu: MenuName;
    anchor: HTMLElement;
  } | null>(null);
  const close = React.useCallback(() => setOpen(null), []);
  const anchorOf = (menu: MenuName) =>
    open?.menu === menu ? open.anchor : null;
  const shown: Record<MenuName, boolean> = {
    file: Boolean(appConfig.loggedInUser),
    view: true,
    tags: entriesPage,
    entries: entriesPage,
    // The Debug menu holds the feature flags' overrides.
    debug: canOverrideFeatureFlags(),
    help: true,
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
        <Logo />
      </Box>
      <Aligner>
        {MENUS.filter(({name}) => shown[name]).map(
          ({name, buttonId, menuId}) => (
            <MenuBarButton
              key={name}
              id={buttonId}
              ariaControls={menuId}
              ariaLabel={t(name)}
              onClick={event =>
                setOpen({menu: name, anchor: event.currentTarget})
              }
            >
              {t(name)}
            </MenuBarButton>
          )
        )}
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
        onClose={close}
        anchorEl={anchorOf('file')}
        entriesPage={entriesPage}
        readOnly={readOnly}
      />
      <ViewMenu onClose={close} anchorEl={anchorOf('view')} />
      <TagsMenu onClose={close} anchorEl={anchorOf('tags')} />
      <EntriesMenu onClose={close} anchorEl={anchorOf('entries')} />
      <DebugMenu onClose={close} anchorEl={anchorOf('debug')} />
      <HelpMenu onClose={close} anchorEl={anchorOf('help')} />
    </>
  );
};

const memoizedMenuBar = React.memo(MenuBar);

export {memoizedMenuBar as MenuBar};
