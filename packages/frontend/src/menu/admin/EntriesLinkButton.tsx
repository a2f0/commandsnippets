import {Button} from '@mui/material';
import React from 'react';
import {useTypedTranslation} from '../../i18n/hooks';
import {Link} from '../../lib/router/Router';
import {menuBarButtonSx} from '../../theme/sx';

interface IProps {
  username: string;
}

/** Back to the signed-in user's entries, from pages without the entry menus. */
const EntriesLinkButton = ({username}: IProps) => {
  const {t} = useTypedTranslation('menu');

  return (
    <Button
      component={Link}
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
