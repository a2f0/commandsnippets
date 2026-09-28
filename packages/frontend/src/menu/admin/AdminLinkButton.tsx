import {Button} from '@mui/material';
import React from 'react';
import {Link as RouterLink} from 'react-router-dom';

import {useTypedTranslation} from '../../i18n/hooks';
import {menuBarButtonSx} from '../../MenuBarButton';
import {ADMIN_PATH} from '../../routePaths';

/** A plain link to the admin page, shown to staff in the menu bar. */
const AdminLinkButton = () => {
  const {t} = useTypedTranslation('admin');

  return (
    <Button
      component={RouterLink}
      to={ADMIN_PATH}
      id="adminLinkButton"
      color="secondary"
      size="small"
      sx={menuBarButtonSx}
    >
      {t('menuLink')}
    </Button>
  );
};

const memoizedAdminLinkButton = React.memo(AdminLinkButton);

export {memoizedAdminLinkButton as AdminLinkButton};
