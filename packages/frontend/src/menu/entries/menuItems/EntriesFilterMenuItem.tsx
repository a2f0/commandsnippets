import {ListItemIcon} from '@mui/material';
import React from 'react';

import {type MenuKeys, useTypedTranslation} from '../../../i18n/hooks';
import {beginInteraction, listKey} from '../../../lib/metrics/timings';
import {
  navigate,
  useRouteParam,
  useSearchParam,
} from '../../../lib/router/navigation';
import {userPath} from '../../../lib/router/route';
import {entrySearchMethod} from '../../../lib/shared';
import {StyledCheckIcon} from '../../../styled/StyledCheckIcon';
import {StyledMenuItem} from '../../StyledMenuItem';

type EntriesFilter = 'all' | 'untagged';

const FILTERS: Record<
  EntriesFilter,
  {method: entrySearchMethod; label: MenuKeys; interaction: string}
> = {
  all: {
    method: entrySearchMethod.allEntries,
    label: 'allEntries',
    interaction: 'all entries',
  },
  untagged: {
    method: entrySearchMethod.untaggedEntryList,
    label: 'untaggedEntries',
    interaction: 'untagged entries',
  },
};

interface IProps {
  filter: EntriesFilter;
  onClose: () => void;
}

/** Entries > All Entries or Untagged Entries: the user's list of them. */
const EntriesFilterMenuItem = ({filter, onClose}: IProps) => {
  const {t} = useTypedTranslation('menu');
  const user = useRouteParam('user');
  const shown = useSearchParam('entries') === filter;
  const {method, label, interaction} = FILTERS[filter];

  return (
    <StyledMenuItem
      id={`entries-menu-list-method-${method}`}
      onClick={() => {
        onClose();
        if (user !== undefined) {
          beginInteraction(interaction, listKey({entries: filter}));
          navigate(`${userPath(user)}?entries=${filter}`);
        }
      }}
    >
      <ListItemIcon>{shown && <StyledCheckIcon />}</ListItemIcon>
      {t(label)}
    </StyledMenuItem>
  );
};

const memoizedEntriesFilterMenuItem = React.memo(EntriesFilterMenuItem);

export {memoizedEntriesFilterMenuItem as EntriesFilterMenuItem};
