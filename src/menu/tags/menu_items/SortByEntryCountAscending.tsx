import {ArrowUpward} from '@mui/icons-material';
import {ListItemIcon} from '@mui/material';
import React from 'react';

import {useAppContext} from '../../../AppContext';
import {StyledMenuItem} from '../../../StyledMenuItem';
import {StyledCheckIcon} from '../../../styled/StyledCheckIcon';

interface IProps {
  onClose: () => void;
}

const SortByEntryCountAscending = ({onClose}: IProps) => {
  const appConfig = useAppContext();

  return (
    <StyledMenuItem
      id="tags-menu-sort-entry-count-ascending"
      onClick={() => {
        appConfig.setTagSortOrder('entry_count');
        onClose();
      }}
    >
      <ListItemIcon>
        {appConfig.tagSortOrder === 'entry_count' && <StyledCheckIcon />}
      </ListItemIcon>
      Sort by Number of Tagged Entries <ArrowUpward fontSize="small" />
    </StyledMenuItem>
  );
};

const memoizedSortEntryCountAscending = React.memo(SortByEntryCountAscending);
export {memoizedSortEntryCountAscending as SortByEntryCountAscending};
