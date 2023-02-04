import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ListItemIcon from '@mui/material/ListItemIcon';
import React from 'react';
import StyledCheckIcon from '../../../styled/StyledCheckIcon';
import StyledMenuItem from '../../../StyledMenuItem';
import {useAppContext} from '../../../AppContext';

interface IProps {
  onClose: () => void;
}

const SortEntryCountAscending = function ({onClose}: IProps) {
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
      Sort by Number of Tagged Entries <ArrowUpwardIcon fontSize="small" />
    </StyledMenuItem>
  );
};

export default React.memo(SortEntryCountAscending);
