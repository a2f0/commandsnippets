import {Chip, Tooltip} from '@mui/material';
import React from 'react';

import {useTypedTranslation} from '../../i18n/hooks';

interface IProps {
  username: string;
}

/**
 * On another user's page (staff reading their data): the data shown is
 * theirs, and nothing on the page changes it.
 */
const ReadOnlyBadge = ({username}: IProps) => {
  const {t} = useTypedTranslation('admin');
  return (
    <Tooltip title={t('readOnlyTooltip', {username})}>
      <Chip
        id="readOnlyBadge"
        size="small"
        color="warning"
        variant="outlined"
        label={t('readOnlyBadge', {username})}
        sx={{alignSelf: 'center', mr: 2}}
      />
    </Tooltip>
  );
};

const memoizedReadOnlyBadge = React.memo(ReadOnlyBadge);

export {memoizedReadOnlyBadge as ReadOnlyBadge};
