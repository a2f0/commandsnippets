import {Button} from '@mui/material';
import React from 'react';
import {Link as RouterLink} from 'react-router-dom';

import {useTypedTranslation} from '../../i18n/hooks';
import {menuBarButtonSx} from '../MenuBarButton';

interface IProps {
  username: string;
}

/** Back to the signed-in user's entries, from pages without the entry menus. */
const EntriesLinkButton = ({username}: IProps) => {
  const {t} = useTypedTranslation('menu');

  return (
    <Button
      component={RouterLink}
      to={`/${username}`}
      id="entriesLinkButton"
      color="secondary"
      size="small"
      sx={menuBarButtonSx}
    >
      {t('entries')}
    </Button>
  );
};

const memoizedEntriesLinkButton = React.memo(EntriesLinkButton);

export {memoizedEntriesLinkButton as EntriesLinkButton};
