import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ListItemIcon from '@mui/material/ListItemIcon';
import React from 'react';
import StyledCheckIcon from '../../../styled/StyledCheckIcon';
import StyledMenuItem from '../../../StyledMenuItem';
import {useAppContext} from '../../../AppContext';

interface IProps {
  onClose: () => void;
}

const SortByEntryCountDescending = function ({onClose}: IProps) {
  const appConfig = useAppContext();

  return (
    <StyledMenuItem
      id="tags-menu-sort-entry-count-descending"
      onClick={() => {
        appConfig.setTagSortOrder('-entry_count');
        onClose();
      }}
    >
      <ListItemIcon>
        {appConfig.tagSortOrder === '-entry_count' && <StyledCheckIcon />}
      </ListItemIcon>
      Sort by Number of Tagged Entries
      <ArrowDownwardIcon fontSize="small" />
    </StyledMenuItem>
  );
};

export default React.memo(SortByEntryCountDescending);
