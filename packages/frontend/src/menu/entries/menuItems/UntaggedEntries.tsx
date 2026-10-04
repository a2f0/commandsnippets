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

const UntaggedEntries = ({onClose}: IProps) => {
  const {t} = useTypedTranslation('menu');
  const user = useRouteParam('user');
  const entriesFilter = useSearchParam('entries');

  return (
    <StyledMenuItem
      id={`entries-menu-list-method-${entrySearchMethod.untaggedEntryList}`}
      onClick={() => {
        if (user !== undefined) {
          beginInteraction('untagged entries', listKey({entries: 'untagged'}));
          navigate(`/${user}?entries=untagged`);
        }
        onClose();
      }}
    >
      <ListItemIcon>
        {entriesFilter === 'untagged' && <StyledCheckIcon />}
      </ListItemIcon>
      {t('untaggedEntries')}
    </StyledMenuItem>
  );
};

const memoizedUntaggedEntries = React.memo(UntaggedEntries);

export {memoizedUntaggedEntries as UntaggedEntries};
