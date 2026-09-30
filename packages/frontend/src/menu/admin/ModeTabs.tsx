import {Tab, Tabs} from '@mui/material';
import type {SxProps, Theme} from '@mui/material/styles';
import type React from 'react';
import {Link as RouterLink, useMatch} from 'react-router-dom';

import {useTypedTranslation} from '../../i18n/hooks';
import {ADMIN_PATH} from '../../routePaths';

type Mode = 'user' | 'admin';

const tabSx: SxProps<Theme> = {
  minHeight: 0,
  minWidth: 0,
  px: 1.5,
  pt: 0.75,
  pb: 0.25,
  fontSize: theme => theme.typography.pxToRem(13),
};

interface IProps {
  username: string;
  /** On another user's page (reading their data): neither tab is selected. */
  readOnly: boolean;
}

/**
 * Staff switch here between using the app as any user does (their entries)
 * and the admin page. The route decides which tab is selected.
 */
const ModeTabs = ({username, readOnly}: IProps) => {
  const {t} = useTypedTranslation('admin');
  const onAdmin = useMatch(ADMIN_PATH) !== null;
  const mode: Mode | false = onAdmin ? 'admin' : readOnly ? false : 'user';

  // The selected tab's link would reload its page (and drop the tag shown).
  const stayOn = (tab: Mode) => (event: React.MouseEvent) => {
    if (tab === mode) {
      event.preventDefault();
    }
  };

  return (
    <Tabs
      id="modeTabs"
      value={mode}
      aria-label={t('modeLabel')}
      textColor="inherit"
      sx={{
        alignSelf: 'stretch',
        alignItems: 'flex-end',
        minHeight: 0,
        mr: 2,
        color: theme => theme.palette.text.primary,
        '& .MuiTabs-indicator': {
          backgroundColor: theme => theme.palette.text.primary,
        },
      }}
    >
      <Tab
        id="userModeTab"
        value="user"
        label={t('userMode')}
        component={RouterLink}
        to={`/${username}`}
        onClick={stayOn('user')}
        sx={tabSx}
      />
      <Tab
        id="adminModeTab"
        value="admin"
        label={t('adminMode')}
        component={RouterLink}
        to={ADMIN_PATH}
        onClick={stayOn('admin')}
        sx={tabSx}
      />
    </Tabs>
  );
};

export {ModeTabs};
