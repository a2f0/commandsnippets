import {ArrowDownward} from '@mui/icons-material';
import {ListItemIcon} from '@mui/material';
import React from 'react';
import StyledCheckIcon from '../../../styled/StyledCheckIcon';
import StyledMenuItem from '../../../StyledMenuItem';
import {useAppContext} from '../../../AppContext';

interface IProps {
  onClose: () => void;
}

const SortByDateCreatedDescending = function ({onClose}: IProps) {
  const appConfig = useAppContext();

  return (
    <StyledMenuItem
      id="tags-menu-sort-date-created-descending"
      onClick={() => {
        appConfig.setTagSortOrder('-date_created');
        onClose();
      }}
    >
      <ListItemIcon>
        {appConfig.tagSortOrder === '-date_created' && <StyledCheckIcon />}
      </ListItemIcon>
      Sort by Date Created <ArrowDownward fontSize="small" />
    </StyledMenuItem>
  );
};

export default React.memo(SortByDateCreatedDescending);
