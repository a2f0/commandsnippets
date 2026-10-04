import {ListItemIcon} from '@mui/material';
import React from 'react';

import {useTypedTranslation} from '../../../i18n/hooks';
import {beginInteraction, listKey} from '../../../lib/metrics/timings';
import {
  navigate,
  useRouteParam,
  useSearchParam,
} from '../../../lib/router/navigation';
import {entrySearchMethod} from '../../../lib/shared';
import {StyledCheckIcon} from '../../../styled/StyledCheckIcon';
import {StyledMenuItem} from '../../StyledMenuItem';

interface IProps {
  onClose: () => void;
}

const AllEntries = ({onClose}: IProps) => {
  const {t} = useTypedTranslation('menu');
  const user = useRouteParam('user');
  const entriesFilter = useSearchParam('entries');

  return (
    <StyledMenuItem
      id={`entries-menu-list-method-${entrySearchMethod.allEntries}`}
      onClick={() => {
        onClose();
        if (user !== undefined) {
          beginInteraction('all entries', listKey({entries: 'all'}));
          navigate(`/${user}?entries=all`);
        }
      }}
    >
      <ListItemIcon>
        {entriesFilter === 'all' && <StyledCheckIcon />}
      </ListItemIcon>
      {t('allEntries')}
    </StyledMenuItem>
  );
};

const memoizedAllEntries = React.memo(AllEntries);

export {memoizedAllEntries as AllEntries};
